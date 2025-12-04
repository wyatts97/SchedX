/**
 * Data Retention Settings API
 * Manages user data retention policies
 * 
 * GET  /api/analytics/retention-settings - Get user's retention settings
 * POST /api/analytics/retention-settings - Update retention settings
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { DataCleanupService } from '$lib/server/services/dataCleanupService';
import logger from '$lib/server/logger';

/**
 * GET /api/analytics/retention-settings
 * Returns current retention settings for the user
 */
export const GET = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const cleanupService = DataCleanupService.getInstance();
		const settings = await cleanupService.getUserRetentionSettings(userId);

		return json({
			success: true,
			settings: {
				snapshotRetentionDays: settings.snapshot_retention_days,
				snapshotActiveTweetDays: settings.snapshot_active_tweet_days,
				followerHistoryRetentionDays: settings.follower_history_retention_days,
				dailyStatsRetentionDays: settings.daily_stats_retention_days,
				contentAnalyticsRetentionDays: settings.content_analytics_retention_days,
				autoCleanupEnabled: settings.auto_cleanup_enabled === 1,
				lastCleanupAt: settings.last_cleanup_at
			}
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error'
		}, 'Failed to fetch retention settings');

		return json(
			{
				error: 'Failed to fetch retention settings',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * POST /api/analytics/retention-settings
 * Update retention settings for the user
 * 
 * Body:
 * - snapshotRetentionDays: number
 * - snapshotActiveTweetDays: number
 * - followerHistoryRetentionDays: number
 * - dailyStatsRetentionDays: number
 * - contentAnalyticsRetentionDays: number
 * - autoCleanupEnabled: boolean
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json();

		// Validate input
		const updates: any = {};

		if (body.snapshotRetentionDays !== undefined) {
			const days = parseInt(body.snapshotRetentionDays);
			if (isNaN(days) || days < 0) {
				return json({ error: 'Invalid snapshotRetentionDays' }, { status: 400 });
			}
			updates.snapshot_retention_days = days;
		}

		if (body.snapshotActiveTweetDays !== undefined) {
			const days = parseInt(body.snapshotActiveTweetDays);
			if (isNaN(days) || days < 0) {
				return json({ error: 'Invalid snapshotActiveTweetDays' }, { status: 400 });
			}
			updates.snapshot_active_tweet_days = days;
		}

		if (body.followerHistoryRetentionDays !== undefined) {
			const days = parseInt(body.followerHistoryRetentionDays);
			if (isNaN(days) || days < 0) {
				return json({ error: 'Invalid followerHistoryRetentionDays' }, { status: 400 });
			}
			updates.follower_history_retention_days = days;
		}

		if (body.dailyStatsRetentionDays !== undefined) {
			const days = parseInt(body.dailyStatsRetentionDays);
			if (isNaN(days) || days < 0) {
				return json({ error: 'Invalid dailyStatsRetentionDays' }, { status: 400 });
			}
			updates.daily_stats_retention_days = days;
		}

		if (body.contentAnalyticsRetentionDays !== undefined) {
			const days = parseInt(body.contentAnalyticsRetentionDays);
			if (isNaN(days) || days < 0) {
				return json({ error: 'Invalid contentAnalyticsRetentionDays' }, { status: 400 });
			}
			updates.content_analytics_retention_days = days;
		}

		if (body.autoCleanupEnabled !== undefined) {
			updates.auto_cleanup_enabled = Boolean(body.autoCleanupEnabled);
		}

		const cleanupService = DataCleanupService.getInstance();
		await cleanupService.updateUserRetentionSettings(userId, updates);

		logger.info({ userId, updates }, 'Updated retention settings');

		return json({
			success: true,
			message: 'Retention settings updated successfully'
		});
	} catch (error) {
		logger.error({
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		}, 'Failed to update retention settings');

		return json(
			{
				error: 'Failed to update retention settings',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
