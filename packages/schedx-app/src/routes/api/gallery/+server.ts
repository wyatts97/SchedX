import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { readdir, stat } from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import logger from '$lib/server/logger';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const MEDIA_METADATA_FILE = path.join(UPLOADS_DIR, 'media-metadata.json');

interface MediaItem {
	id: string;
	url: string;
	type: 'photo' | 'gif' | 'video';
	filename: string;
	uploadedAt: Date;
	fileSize: number;
	accountId?: string | null;
}

function getMediaType(filename: string): 'photo' | 'gif' | 'video' {
	const ext = path.extname(filename).toLowerCase();
	if (ext === '.gif') return 'gif';
	if (['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
	return 'photo';
}

// Load media metadata
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

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Get filter parameters
		const accountId = url.searchParams.get('accountId');

		// Check if uploads directory exists
		try {
			await stat(UPLOADS_DIR);
		} catch {
			// Directory doesn't exist, return empty array
			return json({ media: [] });
		}

		// Load metadata
		const metadata = loadMediaMetadata();

		// Read all files in uploads directory
		const files = await readdir(UPLOADS_DIR);

		// Filter for media files and get their stats
		const mediaFiles = await Promise.all(
			files
				.filter((file) => {
					const ext = path.extname(file).toLowerCase();
					return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'].includes(ext);
				})
				.map(async (filename) => {
					const filePath = path.join(UPLOADS_DIR, filename);
					const stats = await stat(filePath);

					// Get metadata for this file
					const fileMetadata = metadata[filename] || {};

					return {
						id: filename.replace(/\.[^/.]+$/, ''), // Remove extension for ID
						url: `/uploads/${filename}`,
						type: fileMetadata.type || getMediaType(filename),
						filename: fileMetadata.filename || filename,
						uploadedAt: fileMetadata.uploadedAt ? new Date(fileMetadata.uploadedAt) : stats.mtime,
						fileSize: fileMetadata.fileSize || stats.size,
						accountId: fileMetadata.accountId || null
					} as MediaItem;
				})
		);

		// Filter by account if specified
		let filteredMedia = mediaFiles;
		if (accountId) {
			filteredMedia = mediaFiles.filter((media) => media.accountId === accountId);
		}

		// Sort by upload date (newest first)
		filteredMedia.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

		return json({ media: filteredMedia });
	} catch (error) {
		logger.error('Error fetching gallery media');
		return json({ error: 'Failed to fetch media' }, { status: 500 });
	}
};
