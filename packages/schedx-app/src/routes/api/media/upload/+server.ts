import { json } from '@sveltejs/kit';
import { mkdirSync, existsSync, createWriteStream, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import { getEnvironmentConfig } from '$lib/server/env';
import logger from '$lib/server/logger';
import { createFileValidationMiddleware } from '$lib/validation/middleware';
import { mediaUploadSchema } from '$lib/validation/schemas';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';

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

			// Generate unique filename
			const timestamp = Date.now();
			const randomString = Math.random().toString(36).substring(2, 15);
			const extension =
				path.extname(file.name) || (file.type.startsWith('image/') ? '.jpg' : '.mp4');
			const filename = `${timestamp}-${randomString}${extension}`;
			const filepath = path.join(UPLOADS_DIR, filename);

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

			// Save metadata with account information
			const metadata = loadMediaMetadata();
			metadata[filename] = {
				url,
				type: mediaType,
				filename: file.name,
				uploadedAt: new Date().toISOString(),
				fileSize: file.size,
				accountId: accountId || null
			};
			saveMediaMetadata(metadata);

			return json({ url, type: mediaType });
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
