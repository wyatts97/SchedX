import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import logger from '$lib/logger';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { file } = params;

		if (!file) {
			throw error(404, 'Avatar not found');
		}

		// Construct the file path
		// In Docker, uploads are at /app/packages/schedx-app/uploads
		// In dev, they're at process.cwd()/uploads
		const avatarsDir = process.env.DOCKER === 'true'
			? '/app/packages/schedx-app/uploads/avatars'
			: path.join(process.cwd(), 'uploads/avatars');
		const filePath = path.join(avatarsDir, file);

		// Security check: ensure the file is within the avatars directory
		const normalizedFilePath = path.normalize(filePath);
		const normalizedAvatarsDir = path.normalize(avatarsDir);

		if (!normalizedFilePath.startsWith(normalizedAvatarsDir)) {
			throw error(403, 'Access denied');
		}

		// Check if file exists
		if (!existsSync(filePath)) {
			throw error(404, 'Avatar not found');
		}

		// Read the file
		const fileBuffer = readFileSync(filePath);

		// Determine content type based on file extension
		const ext = path.extname(file).toLowerCase();
		let contentType = 'image/jpeg'; // Default to JPEG

		switch (ext) {
			case '.jpg':
			case '.jpeg':
				contentType = 'image/jpeg';
				break;
			case '.png':
				contentType = 'image/png';
				break;
			case '.gif':
				contentType = 'image/gif';
				break;
			case '.webp':
				contentType = 'image/webp';
				break;
		}

		// Return the file with appropriate headers
		return new Response(fileBuffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
				'Content-Length': fileBuffer.length.toString()
			}
		});
	} catch (err) {
		logger.error('Error serving avatar file');

		if (err instanceof Error && err.message.includes('404')) {
			throw error(404, 'Avatar not found');
		}

		throw error(500, 'Internal server error');
	}
};
