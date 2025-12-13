import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Health check endpoint
 * Used by Docker health checks and monitoring
 */
export const GET: RequestHandler = async () => {
	// SECURITY: Don't expose environment details publicly
	return json({
		status: 'healthy',
		timestamp: new Date().toISOString()
	});
};
