import { getDbInstance } from './db';
import { TwitterAuthService } from './twitterAuth';
import { log } from './logger';
import type { Tweet } from '@schedx/shared-lib/types/types';
import * as cron from 'node-cron';

/**
 * Engagement Sync Service
 * Syncs tweet engagement metrics (likes, retweets, replies) and account follower counts from Twitter API
 * Note: Impressions are NOT available in Twitter Free tier
 * Runs daily via cron job and can be triggered manually
 */
export class EngagementSyncService {
	private static instance: EngagementSyncService;
	private isRunning = false;
	private cronJob: cron.ScheduledTask | null = null;

	private constructor() {}

	public static getInstance(): EngagementSyncService {
		if (!EngagementSyncService.instance) {
			EngagementSyncService.instance = new EngagementSyncService();
		}
		return EngagementSyncService.instance;
	}

	/**
	 * Start the scheduler - runs once daily at 3 AM
	 */
	public start(): void {
		if (this.isRunning) {
			log.warn('Engagement sync scheduler already running');
			return;
		}

		this.isRunning = true;
		log.info('Engagement sync scheduler started - will run daily at 3 AM');

		// Run daily at 3:00 AM (cron format: minute hour day month weekday)
		this.cronJob = cron.schedule('0 3 * * *', () => {
			log.info('Running scheduled engagement sync (daily at 3 AM)');
			this.syncAllEngagement().catch((error) => {
				log.error('Error in scheduled engagement sync', { error });
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
		log.info('Engagement sync scheduler stopped');
	}

	/**
	 * Sync engagement metrics for all posted tweets across all users
	 * Limited to 3 tweets per Twitter app per day to stay within free tier
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

			// Get posted tweets that have Twitter IDs (status is lowercase in DB)
			const query = userId
				? `SELECT * FROM tweets WHERE userId = ? AND LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC`
				: `SELECT * FROM tweets WHERE LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC`;
			
			const params = userId ? [userId] : [];
			const tweets = (db as any)['db'].query(query, params);

			if (tweets.length === 0) {
				log.info('No posted tweets found to sync engagement');
				await this.updateSyncStatus(userId, null);
				return stats;
			}

			log.info(`Starting engagement sync for tweets`, { userId, totalTweets: tweets.length });

			// Group tweets by Twitter app (not account) to limit 3 tweets per app
			const tweetsByApp = new Map<string, Tweet[]>();
			const accounts = await db.getAllUserAccounts();
			
			for (const tweet of tweets) {
				const account = accounts.find((acc: any) => acc.providerAccountId === tweet.twitterAccountId);
				if (account && account.twitterAppId) {
					if (!tweetsByApp.has(account.twitterAppId)) {
						tweetsByApp.set(account.twitterAppId, []);
					}
					// Limit to 3 tweets per Twitter app
					if (tweetsByApp.get(account.twitterAppId)!.length < 3) {
						tweetsByApp.get(account.twitterAppId)!.push(tweet);
					} else {
						stats.skipped++;
					}
				}
			}

			// First, sync follower counts for all accounts
			await this.syncFollowerCounts(userId);
			
			// Group selected tweets by account for processing
			const tweetsByAccount = new Map<string, Tweet[]>();
			for (const appTweets of tweetsByApp.values()) {
				for (const tweet of appTweets) {
					const accountId = tweet.twitterAccountId;
					if (accountId) {
						if (!tweetsByAccount.has(accountId)) {
							tweetsByAccount.set(accountId, []);
						}
						tweetsByAccount.get(accountId)!.push(tweet);
					}
				}
			}
			
			// Process each account's tweets
			for (const [accountId, accountTweets] of tweetsByAccount.entries()) {
				try {
					await this.syncAccountEngagement(accountId, accountTweets, stats);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : 'Unknown error';
					log.error('Failed to sync engagement for account', {
						accountId,
						error: errorMsg
					});
					lastError = errorMsg;
					stats.failed += accountTweets.length;
				}
			}

			log.info('Engagement sync completed', stats);
			await this.updateSyncStatus(userId, lastError);
			return stats;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			log.error('Error in engagement sync', { error: errorMsg });
			await this.updateSyncStatus(userId, errorMsg);
			throw error;
		}
	}

	/**
	 * Update sync status in user settings
	 */
	private async updateSyncStatus(userId: string | undefined, error: string | null): Promise<void> {
		if (!userId) return;
		
		try {
			const db = getDbInstance();
			const existing = (db as any)['db'].queryOne(
				'SELECT id FROM user_sync_settings WHERE user_id = ?',
				[userId]
			);

			if (existing) {
				(db as any)['db'].execute(
					'UPDATE user_sync_settings SET last_sync_at = ?, last_sync_error = ?, updated_at = ? WHERE user_id = ?',
					[Date.now(), error, Date.now(), userId]
				);
			} else {
				(db as any)['db'].execute(
					'INSERT INTO user_sync_settings (id, user_id, sync_time, last_sync_at, last_sync_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
					[crypto.randomUUID(), userId, '03:00', Date.now(), error, Date.now(), Date.now()]
				);
			}
		} catch (err) {
			log.error('Failed to update sync status', { error: err });
		}
	}

	/**
	 * Sync engagement for tweets from a specific account
	 */
	private async syncAccountEngagement(
		accountId: string,
		tweets: Tweet[],
		stats: { synced: number; failed: number; skipped: number }
	): Promise<void> {
		const db = getDbInstance();

		// Get the account
		const accounts = await db.getAllUserAccounts();
		const account = accounts.find((acc: any) => acc.providerAccountId === accountId);

		if (!account) {
			log.warn('Account not found, skipping engagement sync', { accountId });
			stats.skipped += tweets.length;
			return;
		}

		// Get Twitter app configuration
		const twitterApp = await db.getTwitterApp(account.twitterAppId);
		if (!twitterApp) {
			log.warn('Twitter app configuration not found', { accountId });
			stats.skipped += tweets.length;
			return;
		}

		// Get authenticated client
		const twitterAuth = TwitterAuthService.getInstance();
		let twitterClient;
		try {
			const result = await twitterAuth.getAuthenticatedClient(account, twitterApp);
			twitterClient = result.client;
		} catch (error) {
			log.error('Failed to get Twitter client', {
				accountId,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
			stats.failed += tweets.length;
			return;
		}

		// Sync each tweet's engagement metrics
		for (const tweet of tweets) {
			try {
				// Fetch tweet data from Twitter API
				const twitterTweet = await twitterClient.v2.singleTweet(tweet.twitterTweetId!, {
					'tweet.fields': ['public_metrics']
				});

				if (!twitterTweet.data || !twitterTweet.data.public_metrics) {
					stats.skipped++;
					continue;
				}

				const metrics = twitterTweet.data.public_metrics;

				// Update tweet in database
				// Note: impression_count is NOT available in Twitter Free tier
				await db.updateTweet(tweet.id!, {
					likeCount: metrics.like_count || 0,
					retweetCount: metrics.retweet_count || 0,
					replyCount: metrics.reply_count || 0,
					updatedAt: new Date()
				});

				stats.synced++;

				// Rate limit protection: delay between requests
				await new Promise(resolve => setTimeout(resolve, 200));
			} catch (error) {
				stats.failed++;
			}
		}
	}

	/**
	 * Sync follower counts for all accounts of a user
	 */
	private async syncFollowerCounts(userId?: string): Promise<void> {
		const db = getDbInstance();
		
		try {
			// Get accounts to sync
			const query = userId
				? 'SELECT * FROM accounts WHERE userId = ?'
				: 'SELECT * FROM accounts';
			const params = userId ? [userId] : [];
			const accounts = (db as any)['db'].query(query, params);
			
			for (const account of accounts) {
				try {
					// Get Twitter app configuration
					const twitterApp = await db.getTwitterApp(account.twitterAppId);
					if (!twitterApp) {
						log.warn('Twitter app configuration not found for follower sync', {
							accountId: account.providerAccountId
						});
						continue;
					}
					
					// Get authenticated client
					const twitterAuth = TwitterAuthService.getInstance();
					const { client: twitterClient } = await twitterAuth.getAuthenticatedClient(
						account,
						twitterApp
					);
					
					// Fetch authenticated user's own data (v2.me works with user context)
					const user = await twitterClient.v2.me({
						'user.fields': ['public_metrics']
					});
					
					if (!user.data || !user.data.public_metrics) {
						continue;
					}
					
					const followerCount = user.data.public_metrics.followers_count;
					
					// Update account in database
					(db as any)['db'].execute(
						'UPDATE accounts SET followersCount = ?, updatedAt = ? WHERE id = ?',
						[followerCount, Date.now(), account.id]
					);
					
					// Insert into daily_stats for historical tracking
					const today = new Date().toISOString().split('T')[0];
					const existingDailyStat = (db as any)['db'].queryOne(
						'SELECT id FROM daily_stats WHERE account_id = ? AND date = ?',
						[account.id, today]
					);
					
					if (existingDailyStat) {
						// Update existing record
						(db as any)['db'].execute(
							'UPDATE daily_stats SET followers = ?, updated_at = ? WHERE id = ?',
							[followerCount, Date.now(), existingDailyStat.id]
						);
					} else {
						// Insert new record
						(db as any)['db'].execute(
							`INSERT INTO daily_stats (id, account_id, date, followers, posts_count, engagement_rate, created_at, updated_at)
							 VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
							[
								crypto.randomUUID(),
								account.id,
								today,
								followerCount,
								Date.now(),
								Date.now()
							]
						);
					}
					
					// Rate limit protection
					await new Promise(resolve => setTimeout(resolve, 150));
				} catch (error) {
					// Silently continue on error
				}
			}
		} catch (error) {
			log.error('Error syncing follower counts', { error });
		}
	}

	/**
	 * Sync engagement for a specific user (manual trigger from UI)
	 * Limited to 3 tweets per Twitter app to stay within free tier
	 * @param userId - User ID to sync engagement for
	 */
	public async syncUserEngagement(userId: string): Promise<{
		synced: number;
		failed: number;
		skipped: number;
	}> {
		log.info('Manual engagement sync triggered', { userId });
		return this.syncAllEngagement(userId);
	}
}

