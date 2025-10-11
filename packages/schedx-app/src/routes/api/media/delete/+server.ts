import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { unlink } from 'fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import logger from '$lib/logger';

// In Docker, uploads are at /app/packages/schedx-app/uploads
// In dev, they're at process.cwd()/uploads
const UPLOADS_DIR = process.env.DOCKER === 'true'
	? '/app/packages/schedx-app/uploads'
	: path.join(process.cwd(), 'uploads');
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

// Save media metadata
function saveMediaMetadata(metadata: Record<string, any>) {
	try {
		writeFileSync(MEDIA_METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
	} catch (error) {
		logger.error('Error saving media metadata');
	}
}

export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const { filename } = await request.json();

		if (!filename) {
			return json({ error: 'Filename is required' }, { status: 400 });
		}

		const filePath = path.join(UPLOADS_DIR, filename);

		// Check if file exists
		if (!existsSync(filePath)) {
			return json({ error: 'File not found' }, { status: 404 });
		}

		// Delete the file
		await unlink(filePath);

		// Remove from metadata
		const metadata = loadMediaMetadata();
		if (metadata[filename]) {
			delete metadata[filename];
			saveMediaMetadata(metadata);
		}

		return json({ success: true, message: 'Media deleted successfully' });
	} catch (error) {
		logger.error('Error deleting media');
		return json({ error: 'Failed to delete media' }, { status: 500 });
	}
};
