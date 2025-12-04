/**
 * Data Cleanup Service
 * Implements data retention policies to prevent unlimited database growth
 * Runs periodically to clean up old engagement snapshots, follower history, etc.
 */

import { getDbInstance } from '../db';
import logger from '../logger';

export interface CleanupStats {
	snapshotsDeleted: number;
	followerHistoryDeleted: number;
	dailyStatsDeleted: number;
	contentAnalyticsDeleted: number;
	insightsDeleted: number;
	totalRecordsDeleted: number;
	duration: number;
}

export class DataCleanupService {
	private static instance: DataCleanupService;

	private constructor() {}

	public static getInstance(): DataCleanupService {
		if (!DataCleanupService.instance) {
			DataCleanupService.instance = new DataCleanupService();
		}
		return DataCleanupService.instance;
	}

	/**
	 * Run cleanup for all users with auto-cleanup enabled
	 */
	public async runGlobalCleanup(): Promise<CleanupStats> {
		const startTime = Date.now();
		const stats: CleanupStats = {
			snapshotsDeleted: 0,
			followerHistoryDeleted: 0,
			dailyStatsDeleted: 0,
			contentAnalyticsDeleted: 0,
			insightsDeleted: 0,
			totalRecordsDeleted: 0,
			duration: 0
		};

		try {
			const db = getDbInstance();

			// Get all users with auto-cleanup enabled
			const users = (db as any)['db'].query(
				`SELECT user_id FROM data_retention_settings WHERE auto_cleanup_enabled = 1`
			);

			logger.info({ userCount: users.length }, 'Starting global data cleanup');

			for (const user of users) {
				const userStats = await this.cleanupUserData(user.user_id);
				stats.snapshotsDeleted += userStats.snapshotsDeleted;
				stats.followerHistoryDeleted += userStats.followerHistoryDeleted;
				stats.dailyStatsDeleted += userStats.dailyStatsDeleted;
				stats.contentAnalyticsDeleted += userStats.contentAnalyticsDeleted;
				stats.insightsDeleted += userStats.insightsDeleted;
			}

			stats.totalRecordsDeleted =
				stats.snapshotsDeleted +
				stats.followerHistoryDeleted +
				stats.dailyStatsDeleted +
				stats.contentAnalyticsDeleted +
				stats.insightsDeleted;

			stats.duration = Date.now() - startTime;

			logger.info(stats, 'Global data cleanup completed');
			return stats;
		} catch (error) {
			logger.error({ error }, 'Failed to run global cleanup');
			throw error;
		}
	}

	/**
	 * Run cleanup for a specific user based on their retention settings
	 */
	public async cleanupUserData(userId: string): Promise<CleanupStats> {
		const startTime = Date.now();
		const stats: CleanupStats = {
			snapshotsDeleted: 0,
			followerHistoryDeleted: 0,
			dailyStatsDeleted: 0,
			contentAnalyticsDeleted: 0,
			insightsDeleted: 0,
			totalRecordsDeleted: 0,
			duration: 0
		};

		try {
			const db = getDbInstance();

			// Get user's retention settings
			const settings = (db as any)['db'].queryOne(
				`SELECT * FROM data_retention_settings WHERE user_id = ?`,
				[userId]
			);

			if (!settings) {
				logger.debug({ userId }, 'No retention settings found, skipping cleanup');
				return stats;
			}

			if (settings.auto_cleanup_enabled !== 1) {
				logger.debug({ userId }, 'Auto-cleanup disabled, skipping');
				return stats;
			}

			logger.info({ userId, settings }, 'Starting user data cleanup');

			const now = Date.now();

			// 1. Clean up old engagement snapshots
			if (settings.snapshot_retention_days > 0) {
				const cutoffDate = new Date(now - settings.snapshot_retention_days * 24 * 60 * 60 * 1000)
					.toISOString()
					.split('T')[0];

				const result = (db as any)['db'].execute(
					`DELETE FROM engagement_snapshots 
					 WHERE snapshot_date < ? 
					 AND tweet_id IN (
						 SELECT t.id FROM tweets t WHERE t.userId = ?
					 )`,
					[cutoffDate, userId]
				);
				stats.snapshotsDeleted = result.changes || 0;
			}

			// 2. Clean up old follower history
			if (settings.follower_history_retention_days > 0) {
				const cutoffTime = now - settings.follower_history_retention_days * 24 * 60 * 60 * 1000;

				const result = (db as any)['db'].execute(
					`DELETE FROM follower_history 
					 WHERE recorded_at < ? 
					 AND account_id IN (
						 SELECT a.id FROM accounts a WHERE a.userId = ?
					 )`,
					[cutoffTime, userId]
				);
				stats.followerHistoryDeleted = result.changes || 0;
			}

			// 3. Clean up old daily stats
			if (settings.daily_stats_retention_days > 0) {
				const cutoffDate = new Date(now - settings.daily_stats_retention_days * 24 * 60 * 60 * 1000)
					.toISOString()
					.split('T')[0];

				const result = (db as any)['db'].execute(
					`DELETE FROM daily_stats 
					 WHERE date < ? 
					 AND account_id IN (
						 SELECT a.id FROM accounts a WHERE a.userId = ?
					 )`,
					[cutoffDate, userId]
				);
				stats.dailyStatsDeleted = result.changes || 0;
			}

			// 4. Clean up old content analytics
			if (settings.content_analytics_retention_days > 0) {
				const cutoffTime = now - settings.content_analytics_retention_days * 24 * 60 * 60 * 1000;

				const result = (db as any)['db'].execute(
					`DELETE FROM content_analytics 
					 WHERE created_at < ? 
					 AND tweet_id IN (
						 SELECT t.id FROM tweets t WHERE t.userId = ?
					 )`,
					[cutoffTime, userId]
				);
				stats.contentAnalyticsDeleted = result.changes || 0;
			}

			// 5. Clean up expired or dismissed insights
			const result = (db as any)['db'].execute(
				`DELETE FROM insights 
				 WHERE user_id = ? 
				 AND (expires_at < ? OR dismissed = 1)`,
				[userId, now]
			);
			stats.insightsDeleted = result.changes || 0;

			// Update last cleanup timestamp
			(db as any)['db'].execute(
				`UPDATE data_retention_settings 
				 SET last_cleanup_at = ?, updated_at = ?
				 WHERE user_id = ?`,
				[now, now, userId]
			);

			stats.totalRecordsDeleted =
				stats.snapshotsDeleted +
				stats.followerHistoryDeleted +
				stats.dailyStatsDeleted +
				stats.contentAnalyticsDeleted +
				stats.insightsDeleted;

			stats.duration = Date.now() - startTime;

			logger.info({ userId, stats }, 'User data cleanup completed');
			return stats;
		} catch (error) {
			logger.error({ error, userId }, 'Failed to cleanup user data');
			throw error;
		}
	}

	/**
	 * Get or create retention settings for a user
	 */
	public async getUserRetentionSettings(userId: string): Promise<any> {
		const db = getDbInstance();

		let settings = (db as any)['db'].queryOne(
			`SELECT * FROM data_retention_settings WHERE user_id = ?`,
			[userId]
		);

		if (!settings) {
			// Create default settings
			const { nanoid } = await import('nanoid');
			const id = nanoid();
			const now = Date.now();

			(db as any)['db'].execute(
				`INSERT INTO data_retention_settings (
					id, user_id, snapshot_retention_days, snapshot_active_tweet_days,
					follower_history_retention_days, daily_stats_retention_days,
					content_analytics_retention_days, auto_cleanup_enabled,
					last_cleanup_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[id, userId, 90, 30, 365, 180, 180, 1, null, now, now]
			);

			settings = (db as any)['db'].queryOne(
				`SELECT * FROM data_retention_settings WHERE user_id = ?`,
				[userId]
			);
		}

		return settings;
	}

	/**
	 * Update retention settings for a user
	 */
	public async updateUserRetentionSettings(
		userId: string,
		settings: Partial<{
			snapshot_retention_days: number;
			snapshot_active_tweet_days: number;
			follower_history_retention_days: number;
			daily_stats_retention_days: number;
			content_analytics_retention_days: number;
			auto_cleanup_enabled: boolean;
		}>
	): Promise<void> {
		const db = getDbInstance();
		const now = Date.now();

		// Build update query dynamically
		const updates: string[] = [];
		const values: any[] = [];

		if (settings.snapshot_retention_days !== undefined) {
			updates.push('snapshot_retention_days = ?');
			values.push(settings.snapshot_retention_days);
		}
		if (settings.snapshot_active_tweet_days !== undefined) {
			updates.push('snapshot_active_tweet_days = ?');
			values.push(settings.snapshot_active_tweet_days);
		}
		if (settings.follower_history_retention_days !== undefined) {
			updates.push('follower_history_retention_days = ?');
			values.push(settings.follower_history_retention_days);
		}
		if (settings.daily_stats_retention_days !== undefined) {
			updates.push('daily_stats_retention_days = ?');
			values.push(settings.daily_stats_retention_days);
		}
		if (settings.content_analytics_retention_days !== undefined) {
			updates.push('content_analytics_retention_days = ?');
			values.push(settings.content_analytics_retention_days);
		}
		if (settings.auto_cleanup_enabled !== undefined) {
			updates.push('auto_cleanup_enabled = ?');
			values.push(settings.auto_cleanup_enabled ? 1 : 0);
		}

		if (updates.length === 0) {
			return;
		}

		updates.push('updated_at = ?');
		values.push(now);
		values.push(userId);

		(db as any)['db'].execute(
			`UPDATE data_retention_settings SET ${updates.join(', ')} WHERE user_id = ?`,
			values
		);

		logger.info({ userId, settings }, 'Updated retention settings');
	}
}
