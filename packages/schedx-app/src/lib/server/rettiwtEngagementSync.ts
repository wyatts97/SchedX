import { getDbInstance } from './db';
import { RettiwtService } from './rettiwtService';
import logger from './logger';
import type { Tweet } from '@schedx/shared-lib/types/types';
import * as cron from 'node-cron';

/**
 * Rettiwt-based Engagement Sync Service
 * Syncs tweet engagement metrics using Rettiwt-API instead of Twitter API
 * No API key limits - uses public API or user's optional cookie
 */
export class RettiwtEngagementSyncService {
	private static instance: RettiwtEngagementSyncService;
	private isRunning = false;
	private cronJob: cron.ScheduledTask | null = null;

	private constructor() {}

	public static getInstance(): RettiwtEngagementSyncService {
		if (!RettiwtEngagementSyncService.instance) {
			RettiwtEngagementSyncService.instance = new RettiwtEngagementSyncService();
		}
		return RettiwtEngagementSyncService.instance;
	}

	/**
	 * Start the scheduler - runs once daily at 3 AM
	 */
	public start(): void {
		if (this.isRunning) {
			logger.warn('Rettiwt engagement sync scheduler already running');
			return;
		}

		this.isRunning = true;
		logger.info('Rettiwt engagement sync scheduler started - will run daily at 3 AM');

		// Run daily at 3:00 AM (cron format: minute hour day month weekday)
		this.cronJob = cron.schedule('0 3 * * *', () => {
			logger.info('Running scheduled Rettiwt engagement sync (daily at 3 AM)');
			this.syncAllEngagement().catch((error) => {
				logger.error({ error }, 'Error in scheduled Rettiwt engagement sync');
			});
		}, {
			timezone: 'Etc/UTC' // Use UTC timezone
		});
	}

	/**
	 * Stop the scheduler
	 */
	public stop(): void {
		if (this.cronJob) {
			this.cronJob.stop();
			this.cronJob = null;
		}
		this.isRunning = false;
		logger.info('Rettiwt engagement sync scheduler stopped');
	}

	/**
	 * Sync engagement metrics for all posted tweets using Rettiwt-API
	 * No rate limits - uses public API or user's optional cookie
	 * @param userId - Optional: sync only for specific user
	 */
	public async syncAllEngagement(userId?: string): Promise<{
		synced: number;
		failed: number;
		skipped: number;
	}> {
		const stats = { synced: 0, failed: 0, skipped: 0 };
		let lastError: string | null = null;

		try {
			const db = getDbInstance();

			// Get posted tweets that have Twitter IDs
			const query = userId
				? `SELECT * FROM tweets WHERE userId = ? AND LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC`
				: `SELECT * FROM tweets WHERE LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC`;
			
			const params = userId ? [userId] : [];
			const tweets = (db as any)['db'].query(query, params);

			if (tweets.length === 0) {
				logger.info('No posted tweets found to sync engagement');
				await this.updateSyncStatus(userId, null);
				return stats;
			}

			logger.info({ userId, totalTweets: tweets.length }, 'Starting Rettiwt engagement sync for tweets');

			// Sync follower counts for all accounts first
			await this.syncFollowerCounts(userId);

			// Process tweets in batches to avoid overwhelming the API
			const batchSize = 10;
			for (let i = 0; i < tweets.length; i += batchSize) {
				const batch = tweets.slice(i, i + batchSize);
				
				await Promise.all(batch.map(async (tweet: any) => {
					try {
						await this.syncTweetEngagement(tweet, userId);
						stats.synced++;
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : 'Unknown error';
						logger.error({ error: errorMsg, tweetId: tweet.id }, 'Failed to sync tweet engagement');
						lastError = errorMsg;
						stats.failed++;
					}
				}));

				// Small delay between batches to be respectful
				if (i + batchSize < tweets.length) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			logger.info(stats, 'Rettiwt engagement sync completed');
			await this.updateSyncStatus(userId, lastError);
			return stats;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			logger.error({ error: errorMsg }, 'Error in Rettiwt engagement sync');
			lastError = errorMsg;
			await this.updateSyncStatus(userId, errorMsg);
			return stats;
		}
	}

	/**
	 * Sync engagement for a single tweet using Rettiwt-API
	 */
	private async syncTweetEngagement(tweet: any, userId?: string): Promise<void> {
		try {
			const db = getDbInstance();
			const tweetId = tweet.twitterTweetId;

			if (!tweetId) {
				throw new Error('Tweet has no Twitter ID');
			}

			// Fetch tweet details using Rettiwt
			const tweetDetails = await RettiwtService.getTweetDetails(tweetId, userId || tweet.userId);

			// Update tweet engagement metrics in database
			(db as any)['db'].execute(
				`UPDATE tweets 
				 SET likeCount = ?, retweetCount = ?, replyCount = ?, impressionCount = ?, updatedAt = ?
				 WHERE id = ?`,
				[
					tweetDetails.likeCount || 0,
					tweetDetails.retweetCount || 0,
					tweetDetails.replyCount || 0,
					tweetDetails.viewCount || 0, // Rettiwt provides view count
					Date.now(),
					tweet.id
				]
			);

			logger.debug({
				tweetId: tweet.id,
				likes: tweetDetails.likeCount,
				retweets: tweetDetails.retweetCount,
				replies: tweetDetails.replyCount,
				views: tweetDetails.viewCount
			}, 'Tweet engagement synced via Rettiwt');
		} catch (error) {
			logger.error({ error, tweetId: tweet.id }, 'Failed to sync tweet engagement via Rettiwt');
			throw error;
		}
	}

	/**
	 * Sync follower counts for all Twitter accounts using Rettiwt-API
	 */
	private async syncFollowerCounts(userId?: string): Promise<void> {
		try {
			const db = getDbInstance();
			
			// Get all Twitter accounts
			const query = userId
				? `SELECT * FROM accounts WHERE userId = ? AND provider = 'twitter'`
				: `SELECT * FROM accounts WHERE provider = 'twitter'`;
			
			const params = userId ? [userId] : [];
			const accounts = (db as any)['db'].query(query, params);

			logger.info({ accountCount: accounts.length }, 'Syncing follower counts via Rettiwt');

			for (const account of accounts) {
				try {
					if (!account.username) {
						logger.warn({ accountId: account.id }, 'Account has no username, skipping');
						continue;
					}

					// Fetch user details using Rettiwt
					const userAnalytics = await RettiwtService.getUserAnalytics(account.username, userId || account.userId);

					// Update follower count in database
					(db as any)['db'].execute(
						`UPDATE accounts SET followerCount = ?, updatedAt = ? WHERE id = ?`,
						[userAnalytics.followers, Date.now(), account.id]
					);

					logger.debug({
						accountId: account.id,
						username: account.username,
						followers: userAnalytics.followers
					}, 'Follower count synced via Rettiwt');
				} catch (error) {
					logger.error({
						error,
						accountId: account.id,
						username: account.username
					}, 'Failed to sync follower count via Rettiwt');
					// Continue with other accounts even if one fails
				}
			}
		} catch (error) {
			logger.error({ error }, 'Failed to sync follower counts via Rettiwt');
			throw error;
		}
	}

	/**
	 * Update sync status in settings
	 */
	private async updateSyncStatus(userId: string | undefined, error: string | null): Promise<void> {
		try {
			const db = getDbInstance();
			const now = Date.now();
			
			// Store sync status in a settings table or similar
			// For now, we'll just log it
			logger.info({
				userId,
				timestamp: now,
				error,
				success: !error
			}, 'Sync status updated');
		} catch (err) {
			logger.error({ error: err }, 'Failed to update sync status');
		}
	}

	/**
	 * Sync engagement for a specific user (for manual triggers)
	 */
	public async syncUserEngagement(userId: string): Promise<{
		synced: number;
		failed: number;
		skipped: number;
	}> {
		return this.syncAllEngagement(userId);
	}
}
