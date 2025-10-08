import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import logger from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentLength = request.headers.get('content-length');
		const sizeInMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;

		logger.debug(`Debug upload - Content-Length: ${contentLength} bytes (${sizeInMB.toFixed(2)} MB)`);
		logger.debug('Request headers received');

		// Try to read the body to see if it succeeds
		const formData = await request.formData();
		const files = formData.getAll('test');

		return json({
			success: true,
			message: `Successfully processed ${files.length} files`,
			contentLength,
			sizeInMB: sizeInMB.toFixed(2),
			headers: Object.fromEntries(request.headers.entries())
		});
	} catch (error) {
		logger.error('Debug upload error');

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				contentLength: request.headers.get('content-length'),
				headers: Object.fromEntries(request.headers.entries())
			},
			{ status: 500 }
		);
	}
};
