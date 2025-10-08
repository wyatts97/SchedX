import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import logger from '$lib/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const contentLength = request.headers.get('content-length');
		const sizeInMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;

		logger.debug(
			`Test upload - Content-Length: ${contentLength} bytes (${sizeInMB.toFixed(2)} MB)`
		);

		// Try to read the body to see if it succeeds
		const formData = await request.formData();
		const files = formData.getAll('test');

		return json({
			success: true,
			message: `Successfully processed ${files.length} files`,
			contentLength,
			sizeInMB: sizeInMB.toFixed(2)
		});
	} catch (error) {
		logger.error('Test upload error');

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				contentLength: request.headers.get('content-length')
			},
			{ status: 500 }
		);
	}
};
