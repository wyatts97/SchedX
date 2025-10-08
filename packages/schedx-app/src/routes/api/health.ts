import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { runHealthChecks, getSimpleHealthCheck } from '$lib/health';
import logger from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const searchParams = url.searchParams;
		const detailed = searchParams.get('detailed') === 'true';

		if (detailed) {
			// Run comprehensive health checks
			const healthStatus = await runHealthChecks();

			const statusCode =
				healthStatus.overall === 'healthy' ? 200 : healthStatus.overall === 'degraded' ? 200 : 503;

			return json(healthStatus, { status: statusCode });
		} else {
			// Simple health check for load balancers
			const simpleCheck = await getSimpleHealthCheck();

			const statusCode = simpleCheck.status === 'ok' ? 200 : 503;

			return json(simpleCheck, { status: statusCode });
		}
	} catch (error) {
		logger.error('Health check failed', { error });

		return json(
			{
				status: 'error',
				message: 'Health check failed',
				timestamp: new Date().toISOString()
			},
			{ status: 503 }
		);
	}
};
