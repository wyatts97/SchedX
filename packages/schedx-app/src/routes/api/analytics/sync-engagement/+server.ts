import { json, type RequestEvent } from '@sveltejs/kit';
import { EngagementSyncService } from '$lib/server/engagementSyncService';
import logger from '$lib/server/logger';

/**
 * POST /api/analytics/sync-engagement
 * Manually trigger engagement sync for the current user's tweets
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		logger.info({ userId }, 'Manual engagement sync requested');

		const syncService = EngagementSyncService.getInstance();
		const result = await syncService.syncUserEngagement(userId, 25); // Limit to 25 tweets for manual sync

		logger.info({
			userId,
			synced: result.synced,
			failed: result.failed,
			skipped: result.skipped
		}, 'Manual engagement sync completed');

		return json({
			success: true,
			data: result,
			message: `Synced ${result.synced} tweets. ${result.failed} failed, ${result.skipped} skipped.`
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, 'Engagement sync failed');

		return json(
			{
				error: 'Failed to sync engagement data',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
