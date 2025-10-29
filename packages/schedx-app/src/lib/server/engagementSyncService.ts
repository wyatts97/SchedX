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
	 * @param userId - Optional: sync only for specific user
	 * @param maxTweets - Optional: limit number of tweets to sync (default: 50)
	 */
	public async syncAllEngagement(userId?: string, maxTweets: number = 50): Promise<{
		synced: number;
		failed: number;
		skipped: number;
	}> {
		const stats = { synced: 0, failed: 0, skipped: 0 };

		try {
			const db = getDbInstance();

			// Get posted tweets that have Twitter IDs (status is lowercase in DB)
			const query = userId
				? `SELECT * FROM tweets WHERE userId = ? AND LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC LIMIT ?`
				: `SELECT * FROM tweets WHERE LOWER(status) = 'posted' AND twitterTweetId IS NOT NULL ORDER BY createdAt DESC LIMIT ?`;
			
			const params = userId ? [userId, maxTweets] : [maxTweets];
			const tweets = (db as any)['db'].query(query, params);

			if (tweets.length === 0) {
				log.info('No posted tweets found to sync engagement');
				return stats;
			}

			log.info(`Starting engagement sync for ${tweets.length} tweets`, { userId });

			// Group tweets by account to minimize API client initialization
			const tweetsByAccount = new Map<string, Tweet[]>();
			for (const tweet of tweets) {
				if (!tweetsByAccount.has(tweet.twitterAccountId)) {
					tweetsByAccount.set(tweet.twitterAccountId, []);
				}
				tweetsByAccount.get(tweet.twitterAccountId)!.push(tweet);
			}

			// First, sync follower counts for all accounts
			await this.syncFollowerCounts(userId);
			
			// Process each account's tweets
			for (const [accountId, accountTweets] of tweetsByAccount.entries()) {
				try {
					await this.syncAccountEngagement(accountId, accountTweets, stats);
				} catch (error) {
					log.error('Failed to sync engagement for account', {
						accountId,
						error: error instanceof Error ? error.message : 'Unknown error'
					});
					stats.failed += accountTweets.length;
				}
			}

			log.info('Engagement sync completed', stats);
			return stats;
		} catch (error) {
			log.error('Error in engagement sync', { error });
			throw error;
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

				if (!twitterTweet.data) {
					log.warn('No data returned from Twitter API', { tweetId: tweet.id });
					stats.skipped++;
					continue;
				}

				const metrics = twitterTweet.data.public_metrics;
				if (!metrics) {
					log.warn('No metrics available for tweet', { tweetId: tweet.id });
					stats.skipped++;
					continue;
				}

				// Update tweet in database
				// Note: impression_count is NOT available in Twitter Free tier
				await db.updateTweet(tweet.id!, {
					likeCount: metrics.like_count || 0,
					retweetCount: metrics.retweet_count || 0,
					replyCount: metrics.reply_count || 0,
					updatedAt: new Date()
				});

				log.debug('Engagement synced for tweet', {
					tweetId: tweet.id,
					likes: metrics.like_count,
					retweets: metrics.retweet_count,
					replies: metrics.reply_count
				});

				stats.synced++;

				// Rate limit protection: small delay between requests
				await new Promise(resolve => setTimeout(resolve, 100));
			} catch (error) {
				log.error('Failed to sync engagement for tweet', {
					tweetId: tweet.id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
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
					
					// Fetch user data from Twitter API
					const user = await twitterClient.v2.me({
						'user.fields': ['public_metrics']
					});
					
					if (!user.data || !user.data.public_metrics) {
						log.warn('No user data returned from Twitter API', {
							accountId: account.providerAccountId
						});
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
					
					log.debug('Follower count synced for account', {
						accountId: account.providerAccountId,
						username: account.username,
						followers: followerCount
					});
					
					// Rate limit protection
					await new Promise(resolve => setTimeout(resolve, 100));
				} catch (error) {
					log.error('Failed to sync follower count for account', {
						accountId: account.providerAccountId,
						error: error instanceof Error ? error.message : 'Unknown error'
					});
				}
			}
		} catch (error) {
			log.error('Error syncing follower counts', { error });
		}
	}

	/**
	 * Sync engagement for a specific user (manual trigger from UI)
	 * @param userId - User ID to sync engagement for
	 * @param maxTweets - Maximum number of tweets to sync (default: 25 for manual refresh)
	 */
	public async syncUserEngagement(userId: string, maxTweets: number = 25): Promise<{
		synced: number;
		failed: number;
		skipped: number;
	}> {
		log.info('Manual engagement sync triggered', { userId, maxTweets });
		return this.syncAllEngagement(userId, maxTweets);
	}
}

