import { json } from '@sveltejs/kit';
import { mkdirSync, existsSync, createWriteStream, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import { getEnvironmentConfig } from '$lib/server/env';
import logger from '$lib/server/logger';
import { createFileValidationMiddleware } from '$lib/validation/middleware';
import { mediaUploadSchema } from '$lib/validation/schemas';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';
import { optimizeImage } from '$lib/server/imageOptimizer';
import { generateVideoThumbnail } from '$lib/server/videoThumbnail';

// Save tweet media to uploads directory (not avatars)
// In Docker, uploads are at /app/packages/schedx-app/uploads
// In dev, they're at process.cwd()/uploads
const UPLOADS_DIR = process.env.DOCKER === 'true'
	? '/app/packages/schedx-app/uploads'
	: path.join(process.cwd(), 'uploads');
const MEDIA_METADATA_FILE = path.join(UPLOADS_DIR, 'media-metadata.json');

if (!existsSync(UPLOADS_DIR)) {
	try {
		mkdirSync(UPLOADS_DIR, { recursive: true });
		logger.debug('Created uploads directory');
	} catch (error) {
		logger.error('Failed to create uploads directory');
	}
}

// Load or create media metadata
function loadMediaMetadata(): Record<string, any> {
	if (!existsSync(MEDIA_METADATA_FILE)) {
		return {};
	}
	try {
		const data = readFileSync(MEDIA_METADATA_FILE, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		logger.error('Error loading media metadata');
		return {};
	}
}

// Save media metadata
function saveMediaMetadata(metadata: Record<string, any>) {
	try {
		writeFileSync(MEDIA_METADATA_FILE, JSON.stringify(metadata, null, 2));
	} catch (error) {
		logger.error('Error saving media metadata');
	}
}

function getMediaType(mimetype: string): 'photo' | 'gif' | 'video' {
	if (mimetype.startsWith('image/')) {
		if (mimetype === 'image/gif') return 'gif';
		return 'photo';
	}
	if (mimetype.startsWith('video/')) return 'video';
	return 'photo';
}

export const POST = userRateLimit(RATE_LIMITS.upload)(
	createFileValidationMiddleware(mediaUploadSchema)(async (data, { request }) => {
		const config = getEnvironmentConfig();

		try {
			// Log request details for debugging
			const contentLength = request.headers.get('content-length');
			logger.debug(`Upload request - Content-Length: ${contentLength} bytes`);

			if (contentLength) {
				const sizeInMB = parseInt(contentLength) / (1024 * 1024);
				logger.debug(`Upload size: ${sizeInMB.toFixed(2)} MB`);
			}

			const { file, accountId } = data;

			logger.debug(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

			// Validate file size using environment variable
			if (file.size > config.MAX_UPLOAD_SIZE) {
				const maxSizeMB = config.MAX_UPLOAD_SIZE / (1024 * 1024);
				return json({ error: `File too large. Maximum size is ${maxSizeMB}MB.` }, { status: 400 });
			}
			// allowed file types (video/quicktime is iOS MOV format)
			const allowedTypes = [
				'image/jpeg',
				'image/png',
				'image/gif',
				'image/webp',
				'video/mp4',
				'video/webm',
				'video/mov',
				'video/quicktime'
			];
			if (!allowedTypes.includes(file.type)) {
				return json({ error: 'File type not supported.' }, { status: 400 });
			}
			const buffer = Buffer.from(await file.arrayBuffer());

			// Generate unique filename with SECURITY: sanitized extension
			const timestamp = Date.now();
			const randomString = Math.random().toString(36).substring(2, 15);
			
			// SECURITY: Map MIME type to safe extension (don't trust user-provided extension)
			const SAFE_EXTENSIONS: Record<string, string> = {
				'image/jpeg': '.jpg',
				'image/png': '.png',
				'image/gif': '.gif',
				'image/webp': '.webp',
				'video/mp4': '.mp4',
				'video/webm': '.webm',
				'video/mov': '.mov',
				'video/quicktime': '.mov'
			};
			
			// SECURITY: Use MIME-based extension, not user-provided filename
			const extension = SAFE_EXTENSIONS[file.type] || '.bin';
			
			// SECURITY: Ensure filename contains only safe characters
			const filename = `${timestamp}-${randomString}${extension}`.replace(/[^a-zA-Z0-9.-]/g, '');
			const filepath = path.join(UPLOADS_DIR, filename);
			
			// SECURITY: Verify path doesn't escape uploads directory (path traversal prevention)
			const resolvedPath = path.resolve(filepath);
			if (!resolvedPath.startsWith(path.resolve(UPLOADS_DIR))) {
				logger.error('Path traversal attempt detected');
				return json({ error: 'Invalid filename' }, { status: 400 });
			}

			// Write file to disk
			const writeStream = createWriteStream(filepath);
			writeStream.write(buffer);
			writeStream.end();

			// Wait for write to complete
			await new Promise<void>((resolve, reject) => {
				writeStream.on('finish', () => resolve());
				writeStream.on('error', reject);
			});

			// Generate URL for the uploaded file
			const url = `/uploads/${filename}`;
			const mediaType = getMediaType(file.type);

			logger.debug(`File uploaded successfully: ${url}`);
			logger.debug(`File saved to: ${filepath}`);
			logger.debug(`Uploads directory: ${UPLOADS_DIR}`);

			// Optimize image or generate video thumbnail
			let optimizedUrl = url;
			let thumbnails: Record<string, string> | null = null;
			let videoThumbnail: string | null = null;
			
			if (mediaType === 'photo') {
				try {
					const optimization = await optimizeImage(filepath, filename, file.type);
					if (optimization) {
						optimizedUrl = optimization.optimizedUrl;
						thumbnails = optimization.thumbnailUrls;
						logger.info(`Image optimized: saved ${optimization.savedPercent}% (${(optimization.savedBytes/1024).toFixed(1)}KB)`);
					}
				} catch (optError) {
					logger.warn(`Image optimization skipped for ${filename}: ${optError instanceof Error ? optError.message : 'Unknown error'}`);
				}
			} else if (mediaType === 'video') {
				// Generate video thumbnail in background
				try {
					const thumbResult = await generateVideoThumbnail(filepath, filename);
					if (thumbResult) {
						videoThumbnail = thumbResult.thumbnailUrl;
						logger.info(`Video thumbnail generated: ${videoThumbnail}`);
					}
				} catch (thumbError) {
					logger.warn(`Video thumbnail generation skipped for ${filename}: ${thumbError instanceof Error ? thumbError.message : 'Unknown error'}`);
				}
			}

			// Save metadata with account information
			const metadata = loadMediaMetadata();
			metadata[filename] = {
				url,
				optimizedUrl,
				thumbnails,
				videoThumbnail,
				type: mediaType,
				filename: file.name,
				uploadedAt: new Date().toISOString(),
				fileSize: file.size,
				accountId: accountId || null
			};
			saveMediaMetadata(metadata);

			return json({ url, optimizedUrl, thumbnails, videoThumbnail, type: mediaType });
		} catch (error) {
			logger.error('Upload error');

			// Provide more specific error messages
			if (error instanceof Error) {
				if (error.message.includes('Content-length') && error.message.includes('exceeds limit')) {
					const maxSizeMB = config.MAX_UPLOAD_SIZE / (1024 * 1024);
					return json(
						{
							error: `File too large. Maximum upload size is ${maxSizeMB}MB. Please try a smaller file.`
						},
						{ status: 413 }
					);
				}
			}

			return json({ error: 'Upload failed' }, { status: 500 });
		}
	})
);
