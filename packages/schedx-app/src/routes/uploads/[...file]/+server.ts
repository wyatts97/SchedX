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
		// Try static/uploads first (for avatars), then uploads (for media)
		const staticUploadsDir = process.env.DOCKER === 'true'
			? '/app/packages/schedx-app/static/uploads'
			: path.join(process.cwd(), 'static/uploads');
		const uploadsDir = process.env.DOCKER === 'true'
			? '/app/packages/schedx-app/uploads'
			: path.join(process.cwd(), 'uploads');
		
		const staticFilePath = path.join(staticUploadsDir, file);
		const uploadsFilePath = path.join(uploadsDir, file);

		logger.info(`Attempting to serve file: ${file}`);
		logger.info(`Checking static path: ${staticFilePath}`);
		logger.info(`Static path exists: ${existsSync(staticFilePath)}`);
		logger.info(`Checking uploads path: ${uploadsFilePath}`);
		logger.info(`Uploads path exists: ${existsSync(uploadsFilePath)}`);

		// Determine which file path to use
		let filePath: string;
		let baseDir: string;
		
		if (existsSync(staticFilePath)) {
			filePath = staticFilePath;
			baseDir = staticUploadsDir;
			logger.info(`Using static path: ${filePath}`);
		} else if (existsSync(uploadsFilePath)) {
			filePath = uploadsFilePath;
			baseDir = uploadsDir;
			logger.info(`Using uploads path: ${filePath}`);
		} else {
			logger.error(`File not found in either location: ${file}`);
			logger.error(`Static dir: ${staticUploadsDir}`);
			logger.error(`Uploads dir: ${uploadsDir}`);
			throw error(404, 'File not found');
		}

		// Security check: ensure the file is within the uploads directory
		const normalizedFilePath = path.normalize(filePath);
		const normalizedBaseDir = path.normalize(baseDir);

		if (!normalizedFilePath.startsWith(normalizedBaseDir)) {
			throw error(403, 'Access denied');
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
		const errorMsg = err instanceof Error ? err.message : String(err);
		logger.error(`Error serving uploaded file: ${errorMsg}`);
		if (err instanceof Error && err.stack) {
			logger.debug(`Stack trace: ${err.stack}`);
		}

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
