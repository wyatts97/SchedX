/**
 * Data Cleanup API
 * Manually trigger data cleanup for the current user
 * 
 * POST /api/analytics/cleanup - Run cleanup for current user
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { DataCleanupService } from '$lib/server/services/dataCleanupService';
import logger from '$lib/server/logger';

/**
 * POST /api/analytics/cleanup
 * Manually trigger data cleanup for the current user
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		logger.info({ userId }, 'Manual data cleanup requested');

		const cleanupService = DataCleanupService.getInstance();
		const stats = await cleanupService.cleanupUserData(userId);

		logger.info({
			userId,
			...stats
		}, 'Manual data cleanup completed');

		return json({
			success: true,
			stats,
			message: `Cleanup completed! Deleted ${stats.totalRecordsDeleted} records in ${Math.round(stats.duration / 1000)}s.`
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, 'Data cleanup failed');

		return json(
			{
				error: 'Failed to run cleanup',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
