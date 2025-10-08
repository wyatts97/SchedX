import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Health check endpoint
 * Used by Docker health checks and monitoring
 */
export const GET: RequestHandler = async () => {
	return json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || '1.0.0',
		environment: process.env.NODE_ENV || 'development'
	});
};
