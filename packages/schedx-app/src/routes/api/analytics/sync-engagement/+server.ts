import { json, type RequestEvent } from '@sveltejs/kit';
import { AccountSyncService } from '$lib/server/services/accountSyncService';
import { clearAnalyticsCache } from '$lib/server/analytics/cache';
import logger from '$lib/server/logger';

/**
 * POST /api/analytics/sync-engagement
 * Manually trigger engagement sync for the current user's accounts using Rettiwt-API
 * Uses new AccountSyncService for per-account tracking and better scalability
 * No rate limits - uses public API or user's optional API key for enhanced access
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		logger.info({ userId }, 'Manual account engagement sync requested');

		const syncService = AccountSyncService.getInstance();
		const stats = await syncService.syncUserAccounts(userId);

		// Count how many accounts had followers synced
		const accountsWithFollowersSynced = stats.results.filter(r => r.followersSynced).length;

		logger.info({
			userId,
			totalAccounts: stats.totalAccounts,
			successfulAccounts: stats.successfulAccounts,
			failedAccounts: stats.failedAccounts,
			totalTweetsSynced: stats.totalTweetsSynced,
			totalTweetsFailed: stats.totalTweetsFailed,
			accountsWithFollowersSynced
		}, 'Manual account engagement sync completed');

		// Clear analytics cache so Overview Tab shows fresh data
		clearAnalyticsCache(userId);
		logger.debug({ userId }, 'Analytics cache cleared after sync');

		return json({
			success: stats.failedAccounts === 0,
			data: stats,
			message: `Synced ${stats.totalTweetsSynced} tweets and ${accountsWithFollowersSynced} account follower counts. ${stats.failedAccounts > 0 ? `${stats.failedAccounts} accounts failed.` : ''}`
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, 'Account engagement sync failed');

		return json(
			{
				error: 'Failed to sync engagement data',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
