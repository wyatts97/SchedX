import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import logger from '$lib/logger';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { file } = params;

		if (!file) {
			throw error(404, 'File not found');
		}

		// Construct the file path
		// When running in dev, cwd is already in packages/schedx-app
		// In Docker container, cwd is /app, so we need packages/schedx-app/uploads
		const cwd = process.cwd();
		const uploadsDir = path.join(cwd, 'uploads');
		const filePath = path.join(uploadsDir, file);

		logger.debug(`Attempting to serve file: ${file}`);
		logger.debug(`Current working directory: ${cwd}`);
		logger.debug(`Uploads directory: ${uploadsDir}`);
		logger.debug(`File path: ${filePath}`);

		// Security check: ensure the file is within the uploads directory
		const normalizedFilePath = path.normalize(filePath);
		const normalizedUploadsDir = path.normalize(uploadsDir);

		if (!normalizedFilePath.startsWith(normalizedUploadsDir)) {
			throw error(403, 'Access denied');
		}

		// Check if file exists
		if (!existsSync(filePath)) {
			logger.debug(`File not found: ${filePath}`);
			throw error(404, 'File not found');
		}

		// Read the file
		const fileBuffer = readFileSync(filePath);

		// Determine content type based on file extension
		const ext = path.extname(file).toLowerCase();
		let contentType = 'application/octet-stream';

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
			case '.mp4':
				contentType = 'video/mp4';
				break;
			case '.webm':
				contentType = 'video/webm';
				break;
			case '.mov':
				contentType = 'video/quicktime';
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
		logger.error('Error serving uploaded file');

		if (err instanceof Error) {
			if (err.message.includes('404')) {
				throw error(404, 'File not found');
			}
			if (err.message.includes('403')) {
				throw error(403, 'Access denied');
			}
		}

		throw error(500, 'Internal server error');
	}
};
