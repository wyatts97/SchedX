/**
 * Account-Level Sync Service
 * Manages engagement sync and follower tracking per Twitter account
 * Supports multiple accounts with individual Rettiwt API keys
 */

import { getDbInstance } from '../db';
import { RettiwtService } from '../rettiwtService';
import logger from '../logger';
import { nanoid } from 'nanoid';

export interface AccountSyncResult {
	accountId: string;
	username: string;
	tweetsProcessed: number;
	tweetsSynced: number;
	tweetsFailed: number;
	tweetsDeleted: number;
	tweetsSkipped: number;
	followersSynced: boolean;
	error?: string;
}

export interface SyncStats {
	totalAccounts: number;
	successfulAccounts: number;
	failedAccounts: number;
	totalTweetsSynced: number;
	totalTweetsFailed: number;
	results: AccountSyncResult[];
}

export class AccountSyncService {
	private static instance: AccountSyncService;

	private constructor() {}

	public static getInstance(): AccountSyncService {
		if (!AccountSyncService.instance) {
			AccountSyncService.instance = new AccountSyncService();
		}
		return AccountSyncService.instance;
	}

	/**
	 * Sync all Twitter accounts for a user
	 */
	public async syncUserAccounts(userId: string): Promise<SyncStats> {
		const db = getDbInstance();
		const stats: SyncStats = {
			totalAccounts: 0,
			successfulAccounts: 0,
			failedAccounts: 0,
			totalTweetsSynced: 0,
			totalTweetsFailed: 0,
			results: []
		};

		try {
			// Get all Twitter accounts for user with sync enabled
			// Note: sync_enabled may be NULL for accounts created before migration 017
			const accounts = (db as any)['db'].query(
				`SELECT * FROM accounts 
				 WHERE userId = ? AND provider = 'twitter' AND (sync_enabled = 1 OR sync_enabled IS NULL)`,
				[userId]
			);

			stats.totalAccounts = accounts.length;

			if (accounts.length === 0) {
				logger.info({ userId }, 'No Twitter accounts found for sync');
				return stats;
			}

			logger.info({ userId, accountCount: accounts.length }, 'Starting account sync');

			// Sync each account
			for (const account of accounts) {
				const result = await this.syncAccount(account, userId);
				stats.results.push(result);

				if (result.error) {
					stats.failedAccounts++;
				} else {
					stats.successfulAccounts++;
				}

				stats.totalTweetsSynced += result.tweetsSynced;
				stats.totalTweetsFailed += result.tweetsFailed;

				// Small delay between accounts
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			logger.info(stats, 'User account sync completed');
			return stats;
		} catch (error) {
			logger.error({ error, userId }, 'Failed to sync user accounts');
			throw error;
		}
	}

	/**
	 * Sync a single Twitter account
	 */
	public async syncAccount(account: any, userId: string): Promise<AccountSyncResult> {
		const result: AccountSyncResult = {
			accountId: account.id,
			username: account.username || 'unknown',
			tweetsProcessed: 0,
			tweetsSynced: 0,
			tweetsFailed: 0,
			tweetsDeleted: 0,
			tweetsSkipped: 0,
			followersSynced: false
		};

		const startTime = Date.now();

		try {
			const db = getDbInstance();

			logger.info({ accountId: account.id, username: account.username }, 'Syncing account');

			// 1. Sync follower counts
			try {
				await this.syncFollowerCount(account, userId);
				result.followersSynced = true;
			} catch (error) {
				logger.error({ error, accountId: account.id }, 'Failed to sync follower count');
				// Continue with tweet sync even if follower sync fails
			}

			// 2. Get posted tweets for this account (only recent tweets for engagement sync)
			// Note: twitterAccountId stores providerAccountId (Twitter's numeric ID), not the UUID
			// 
			// Smart sync strategy:
			// - Tweets < 7 days: Always sync (high engagement activity)
			// - Tweets 7-30 days: Sync if not updated in last 24 hours
			// - Tweets > 30 days: Skip (engagement has stabilized)
			const now = Date.now();
			const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
			const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
			const oneDayAgo = now - (24 * 60 * 60 * 1000);
			
			const tweets = (db as any)['db'].query(
				`SELECT * FROM tweets 
				 WHERE twitterAccountId = ? 
				   AND LOWER(status) = 'posted' 
				   AND twitterTweetId IS NOT NULL
				   AND (
				     -- Tier 1: Always sync tweets < 7 days old
				     createdAt > ?
				     OR
				     -- Tier 2: Sync tweets 7-30 days old if not updated recently
				     (createdAt > ? AND createdAt <= ? AND (updatedAt IS NULL OR updatedAt < ?))
				   )
				 ORDER BY createdAt DESC
				 LIMIT 200`,
				[account.providerAccountId, sevenDaysAgo, thirtyDaysAgo, sevenDaysAgo, oneDayAgo]
			);
			
			// Also get total count for logging
			const totalTweets = (db as any)['db'].queryOne(
				`SELECT COUNT(*) as count FROM tweets 
				 WHERE twitterAccountId = ? AND LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL`,
				[account.providerAccountId]
			);

			result.tweetsProcessed = tweets.length;
			
			logger.info({ 
				accountId: account.id, 
				recentTweets: tweets.length,
				totalTweets: totalTweets?.count || 0,
				message: `Syncing ${tweets.length} recent tweets (of ${totalTweets?.count || 0} total)`
			}, 'Smart sync: processing recent tweets only');

			if (tweets.length === 0) {
				logger.info({ accountId: account.id }, 'No tweets to sync');
				await this.updateSyncStatus(account.id, 'success', null, 0, 0);
				return result;
			}

			// 3. Sync tweets in batches
			const batchSize = 10;
			for (let i = 0; i < tweets.length; i += batchSize) {
				const batch = tweets.slice(i, i + batchSize);

				await Promise.all(
					batch.map(async (tweet: any) => {
						try {
							const syncResult = await this.syncTweetEngagement(tweet, account, userId);
							if (syncResult === 'synced') {
								result.tweetsSynced++;
							} else if (syncResult === 'deleted') {
								result.tweetsDeleted++;
							} else if (syncResult === 'skipped') {
								result.tweetsSkipped++;
							}
						} catch (error) {
							logger.error({ error, tweetId: tweet.id }, 'Failed to sync tweet');
							result.tweetsFailed++;
						}
					})
				);

				// Delay between batches
				if (i + batchSize < tweets.length) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			// 4. Update account metadata
			const updateTime = Date.now();
			(db as any)['db'].execute(
				`UPDATE accounts 
				 SET last_tweet_sync_at = ?, total_tweets_synced = ?, updatedAt = ?
				 WHERE id = ?`,
				[updateTime, result.tweetsSynced, updateTime, account.id]
			);

			// 5. Update sync status
			// Only count as 'partial' if there were actual failures (not deleted/skipped tweets)
			const syncStatus = result.tweetsFailed === 0 ? 'success' : 'partial';
			await this.updateSyncStatus(
				account.id,
				syncStatus,
				null,
				result.tweetsSynced,
				result.tweetsFailed
			);

			logger.info({
				account_id: account.id,
				duration: Date.now() - startTime,
				...result
			}, 'Account sync completed');

			return result;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			result.error = errorMsg;

			await this.updateSyncStatus(
				account.id,
				'failed',
				errorMsg,
				result.tweetsSynced,
				result.tweetsFailed
			);

			logger.error({ error, accountId: account.id }, 'Account sync failed');
			return result;
		}
	}

	/**
	 * Sync engagement for a single tweet
	 * Returns 'synced' | 'deleted' | 'skipped' to indicate result
	 */
	private async syncTweetEngagement(tweet: any, account: any, userId: string): Promise<'synced' | 'deleted' | 'skipped'> {
		const db = getDbInstance();
		const tweetId = tweet.twitterTweetId;

		if (!tweetId) {
			logger.warn({ tweetDbId: tweet.id }, 'Tweet has no Twitter ID, skipping');
			return 'skipped';
		}

		try {
			// Use user-level API key (account-level support to be added)
			const tweetDetails = await RettiwtService.getTweetDetails(tweetId, userId);

			// Update tweet engagement metrics and media
			(db as any)['db'].execute(
				`UPDATE tweets 
				 SET likeCount = ?, retweetCount = ?, replyCount = ?, impressionCount = ?, media = ?, updatedAt = ?
				 WHERE id = ?`,
				[
					tweetDetails.likeCount,
					tweetDetails.retweetCount,
					tweetDetails.replyCount,
					tweetDetails.viewCount,
					JSON.stringify(tweetDetails.media || []),
					Date.now(),
					tweet.id
				]
			);

			// Create engagement snapshot if tweet is recent (< 30 days old)
			const tweetAge = Math.floor((Date.now() - tweet.createdAt) / (1000 * 60 * 60 * 24));
			if (tweetAge <= 30) {
				await this.createEngagementSnapshot(tweet.id, account.id, tweetAge);
			}

			logger.debug({
				tweetId: tweet.id,
				likes: tweetDetails.likeCount,
				retweets: tweetDetails.retweetCount,
				replies: tweetDetails.replyCount,
				views: tweetDetails.viewCount
			}, 'Tweet engagement synced');
			
			return 'synced';
		} catch (error: any) {
			// Check if tweet was deleted or not found
			const errorMsg = error.message?.toLowerCase() || '';
			if (errorMsg.includes('not found') || errorMsg.includes('deleted')) {
				// Mark tweet as deleted in database
				(db as any)['db'].execute(
					`UPDATE tweets SET status = 'deleted', updatedAt = ? WHERE id = ?`,
					[Date.now(), tweet.id]
				);
				logger.info({ tweetId, tweetDbId: tweet.id }, 'Tweet marked as deleted (not found on Twitter)');
				return 'deleted';
			}
			
			// Re-throw other errors
			throw error;
		}
	}

	/**
	 * Sync follower count for an account
	 */
	private async syncFollowerCount(account: any, userId: string): Promise<void> {
		if (!account.username) {
			throw new Error('Account has no username');
		}

		const db = getDbInstance();
		// Use user-level API key (account-level support to be added)
		const userAnalytics = await RettiwtService.getUserAnalytics(
			account.username,
			userId
		);

		const now = Date.now();

		// Update account follower count
		(db as any)['db'].execute(
			`UPDATE accounts 
			 SET followerCount = ?, last_follower_sync_at = ?, updatedAt = ?
			 WHERE id = ?`,
			[userAnalytics.followers, now, now, account.id]
		);

		// Create follower history entry
		const historyId = nanoid();
		(db as any)['db'].execute(
			`INSERT INTO follower_history (id, account_id, follower_count, following_count, recorded_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[historyId, account.id, userAnalytics.followers, userAnalytics.following || 0, now]
		);

		logger.debug({
			accountId: account.id,
			username: account.username,
			followers: userAnalytics.followers
		}, 'Follower count synced');
	}

	/**
	 * Create engagement snapshot for a tweet
	 */
	private async createEngagementSnapshot(
		tweetId: string,
		accountId: string,
		tweetAgeDays: number
	): Promise<void> {
		const db = getDbInstance();
		const today = new Date().toISOString().split('T')[0];

		// Check if snapshot already exists
		const existing = (db as any)['db'].queryOne(
			'SELECT id FROM engagement_snapshots WHERE tweet_id = ? AND snapshot_date = ?',
			[tweetId, today]
		);

		if (existing) {
			return; // Already have snapshot for today
		}

		// Get current tweet metrics
		const tweet = (db as any)['db'].queryOne(
			'SELECT likeCount, retweetCount, replyCount, impressionCount FROM tweets WHERE id = ?',
			[tweetId]
		);

		if (!tweet) {
			return;
		}

		const snapshotId = nanoid();
		(db as any)['db'].execute(
			`INSERT INTO engagement_snapshots (
				id, tweet_id, account_id, snapshot_date, tweet_age_days,
				like_count, retweet_count, reply_count, impression_count, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				snapshotId,
				tweetId,
				accountId,
				today,
				tweetAgeDays,
				tweet.likeCount || 0,
				tweet.retweetCount || 0,
				tweet.replyCount || 0,
				tweet.impressionCount || 0,
				Date.now()
			]
		);
	}

	/**
	 * Update sync status for an account
	 */
	private async updateSyncStatus(
		accountId: string,
		status: 'success' | 'partial' | 'failed',
		error: string | null,
		tweetsSynced: number,
		tweetsFailed: number
	): Promise<void> {
		const db = getDbInstance();
		const now = Date.now();

		// Calculate next sync time (24 hours from now)
		const nextSync = now + 24 * 60 * 60 * 1000;

		// Upsert sync status
		const existing = (db as any)['db'].queryOne(
			'SELECT id FROM account_sync_status WHERE account_id = ?',
			[accountId]
		);

		if (existing) {
			(db as any)['db'].execute(
				`UPDATE account_sync_status
				 SET last_sync_at = ?, last_sync_status = ?, last_error = ?,
				     tweets_synced = ?, tweets_failed = ?, next_sync_at = ?, updated_at = ?
				 WHERE account_id = ?`,
				[now, status, error, tweetsSynced, tweetsFailed, nextSync, now, accountId]
			);
		} else {
			const statusId = nanoid();
			(db as any)['db'].execute(
				`INSERT INTO account_sync_status (
					id, account_id, last_sync_at, last_sync_status, last_error,
					tweets_synced, tweets_failed, next_sync_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[statusId, accountId, now, status, error, tweetsSynced, tweetsFailed, nextSync, now, now]
			);
		}
	}

	/**
	 * Get sync status for all accounts of a user
	 */
	public async getUserAccountsSyncStatus(userId: string): Promise<any[]> {
		const db = getDbInstance();

		const results = (db as any)['db'].query(
			`SELECT 
				a.id as account_id,
				a.username,
				a.displayName,
				a.profileImage,
				a.followerCount,
				a.last_tweet_sync_at,
				a.last_follower_sync_at,
				a.total_tweets_synced,
				a.sync_enabled,
				s.last_sync_at,
				s.last_sync_status,
				s.last_error,
				s.tweets_synced,
				s.tweets_failed,
				s.next_sync_at
			FROM accounts a
			LEFT JOIN account_sync_status s ON a.id = s.account_id
			WHERE a.userId = ? AND a.provider = 'twitter'
			ORDER BY a.username`,
			[userId]
		);

		return results;
	}
}
