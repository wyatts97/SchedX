import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import logger from '$lib/server/logger';

// In Docker, uploads are at /app/packages/schedx-app/uploads
// In dev, they're at process.cwd()/uploads
const UPLOADS_DIR =
	process.env.DOCKER === 'true'
		? '/app/packages/schedx-app/uploads'
		: path.join(process.cwd(), 'uploads');

const MEDIA_METADATA_FILE = path.join(UPLOADS_DIR, 'media-metadata.json');

// Load media metadata
function loadMediaMetadata(): Record<string, any> {
	if (!existsSync(MEDIA_METADATA_FILE)) {
		return {};
	}
	try {
		const data = readFile(MEDIA_METADATA_FILE, 'utf8');
		return JSON.parse(data.toString());
	} catch (error) {
		logger.error('Error loading media metadata');
		return {};
	}
}

// Save media metadata
async function saveMediaMetadata(metadata: Record<string, any>): Promise<void> {
	try {
		await writeFile(MEDIA_METADATA_FILE, JSON.stringify(metadata, null, 2));
	} catch (error) {
		logger.error('Error saving media metadata');
		throw error;
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Check if user is authenticated (admin)
		const adminSession = cookies.get('admin_session');
		if (!adminSession || adminSession.trim() === '') {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const originalFilename = formData.get('filename') as string;

		if (!file || !originalFilename) {
			return json({ error: 'Missing file or filename' }, { status: 400 });
		}

		// Validate that the original file exists
		const originalFilePath = path.join(UPLOADS_DIR, originalFilename);
		if (!existsSync(originalFilePath)) {
			return json({ error: 'Original file not found' }, { status: 404 });
		}

		// Convert the file to a buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Write the new file, replacing the old one
		await writeFile(originalFilePath, buffer);

		// Update metadata (preserve existing metadata, just update fileSize)
		const metadata = loadMediaMetadata();
		if (metadata[originalFilename]) {
			metadata[originalFilename].fileSize = buffer.length;
			metadata[originalFilename].updatedAt = new Date().toISOString();
			await saveMediaMetadata(metadata);
		}

		logger.info(`Updated media file: ${originalFilename}`);

		return json({
			success: true,
			filename: originalFilename,
			url: `/uploads/${originalFilename}`
		});
	} catch (error) {
		logger.error(`Error updating media file: ${error instanceof Error ? error.message : String(error)}`);
		return json({ error: 'Failed to update media file' }, { status: 500 });
	}
};
