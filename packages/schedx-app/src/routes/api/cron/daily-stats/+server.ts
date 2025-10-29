/**
 * Daily Stats Cron API Endpoint
 * 
 * Provides manual trigger and status checking for the daily analytics collection.
 * 
 * GET  - Get cron job status
 * POST - Manually trigger analytics collection
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { triggerManualCollection, getCronStatus } from '$lib/server/cron/dailyAnalytics';
import logger from '$lib/server/logger';

/**
 * GET /api/cron/daily-stats
 * 
 * Returns the current status of the daily analytics cron job.
 * 
 * Response:
 * {
 *   isRunning: boolean,
 *   lastRunTime: Date | null,
 *   lastRunStatus: 'success' | 'failed' | 'partial',
 *   lastRunResults: { success: number, failed: number, errors: string[] } | null,
 *   nextRunTime: Date
 * }
 */
export const GET: RequestHandler = async ({ cookies }) => {
	// Verify admin session
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const status = getCronStatus();
		
		logger.info('Cron status requested');
		
		return json({
			success: true,
			status
		});
	} catch (error) {
		logger.error({ error }, 'Failed to get cron status');
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to get status'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/cron/daily-stats
 * 
 * Manually triggers the daily analytics collection.
 * 
 * This is useful for:
 * - Testing the collection process
 * - Immediate data refresh
 * - Backfilling missed data
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   results?: { success: number, failed: number, errors: string[] }
 * }
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
	// Verify admin session
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		logger.info('Manual analytics collection triggered');
		
		const result = await triggerManualCollection();
		
		if (result.success) {
			logger.info({ results: result.results }, 'Manual collection completed');
			return json(result);
		} else {
			logger.warn({ message: result.message }, 'Manual collection failed');
			return json(result, { status: 400 });
		}
	} catch (error) {
		logger.error({ error }, 'Failed to trigger manual collection');
		return json(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Collection failed'
			},
			{ status: 500 }
		);
	}
};
