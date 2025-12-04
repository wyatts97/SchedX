/**
 * Account Sync API
 * Manages per-account engagement sync and status tracking
 * 
 * GET  /api/analytics/account-sync - Get sync status for all user accounts
 * POST /api/analytics/account-sync - Trigger sync for all or specific account
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { AccountSyncService } from '$lib/server/services/accountSyncService';
import logger from '$lib/server/logger';

/**
 * GET /api/analytics/account-sync
 * Returns sync status for all Twitter accounts of the current user
 */
export const GET = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const syncService = AccountSyncService.getInstance();
		const accountsStatus = await syncService.getUserAccountsSyncStatus(userId);

		return json({
			success: true,
			accounts: accountsStatus
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error'
		}, 'Failed to fetch account sync status');

		return json(
			{
				error: 'Failed to fetch sync status',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/analytics/account-sync
 * Trigger engagement sync for all accounts or a specific account
 * 
 * Body (optional):
 * - accountId: string - Sync only this account
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json().catch(() => ({}));
		const accountId = body.accountId;

		logger.info({ userId, accountId }, 'Account sync requested');

		const syncService = AccountSyncService.getInstance();

		if (accountId) {
			// Sync specific account
			const db = await import('$lib/server/db').then(m => m.getDbInstance());
			const account = (db as any)['db'].queryOne(
				'SELECT * FROM accounts WHERE id = ? AND userId = ?',
				[accountId, userId]
			);

			if (!account) {
				return json({ error: 'Account not found' }, { status: 404 });
			}

			const result = await syncService.syncAccount(account, userId);

			return json({
				success: !result.error,
				data: result,
				message: result.error
					? `Sync failed: ${result.error}`
					: `Synced ${result.tweetsSynced} tweets for @${result.username}`
			});
		} else {
			// Sync all accounts
			const stats = await syncService.syncUserAccounts(userId);

			return json({
				success: stats.failedAccounts === 0,
				data: stats,
				message: `Synced ${stats.totalTweetsSynced} tweets across ${stats.successfulAccounts} accounts. ${stats.failedAccounts} accounts failed.`
			});
		}
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, 'Account sync failed');

		return json(
			{
				error: 'Failed to sync accounts',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
