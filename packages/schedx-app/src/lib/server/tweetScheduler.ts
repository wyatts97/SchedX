import { getDbInstance, getRawDbInstance } from './db';
import { TwitterAuthService } from './twitterAuth';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import type { Tweet } from '@schedx/shared-lib/types/types';
import { log } from './logger';
import { TwitterApi } from 'twitter-api-v2';
import { readFileSync } from 'fs';
import path from 'path';
import { emailNotificationService } from './emailNotificationService';
import { pushNotificationService } from './pushNotificationService';

// Default retry configuration
const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 60 * 1000; // 1 minute base delay
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour max delay

/**
 * Tweet Scheduler Service
 * Processes scheduled tweets and posts them to Twitter
 * Includes automatic retry logic with exponential backoff for failed tweets
 */
export class TweetSchedulerService {
	private static instance: TweetSchedulerService;
	private isRunning = false;
	private intervalId: NodeJS.Timeout | null = null;

	private constructor() {}

	/**
	 * Calculate next retry time using exponential backoff
	 * Delay doubles with each retry: 1min, 2min, 4min, etc. (capped at 1 hour)
	 */
	private calculateNextRetryTime(retryCount: number): Date {
		const delay = Math.min(
			BASE_RETRY_DELAY_MS * Math.pow(2, retryCount),
			MAX_RETRY_DELAY_MS
		);
		return new Date(Date.now() + delay);
	}

	public static getInstance(): TweetSchedulerService {
		if (!TweetSchedulerService.instance) {
			TweetSchedulerService.instance = new TweetSchedulerService();
		}
		return TweetSchedulerService.instance;
	}

	/**
	 * Start the scheduler
	 * Checks for due tweets every minute
	 */
	public start(intervalMs: number = 60000): void {
		if (this.isRunning) {
			log.warn('Scheduler already running');
			return;
		}

		this.isRunning = true;
		log.info('Tweet scheduler started', { intervalMs });

		// On startup, immediately reset any stale tweets from previous crashes
		// This ensures quick recovery after server restarts
		this.resetStaleProcessingTweets().then(() => {
			log.info('Startup stale tweet check completed');
		}).catch((error) => {
			log.error('Error in startup stale tweet check', { error });
		});

		// Run immediately on start
		this.processDueTweets().catch((error) => {
			log.error('Error in initial scheduler run', { error });
		});

		// Then run on interval
		this.intervalId = setInterval(() => {
			this.processDueTweets().catch((error) => {
				log.error('Error in scheduler interval', { error });
			});
		}, intervalMs);
	}

	/**
	 * Stop the scheduler
	 */
	public stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.isRunning = false;
		log.info('Tweet scheduler stopped');
	}

	/**
	 * Atomically claim a tweet for processing
	 * Returns true if claim was successful, false if tweet was already claimed/processed
	 */
	private claimTweetForProcessing(tweetId: string): boolean {
		const rawDb = getRawDbInstance();
		const now = Date.now();
		
		// Atomic update: only succeeds if tweet is still SCHEDULED and not already posted
		const result = rawDb.execute(
			`UPDATE tweets 
			 SET status = ?, updatedAt = ? 
			 WHERE id = ? 
			 AND status = ? 
			 AND twitterTweetId IS NULL`,
			[TweetStatus.PROCESSING, now, tweetId, TweetStatus.SCHEDULED]
		);
		
		// If changes === 1, we successfully claimed the tweet
		return result.changes === 1;
	}

	/**
	 * Process all tweets that are due to be posted (including retries)
	 */
	private async processDueTweets(): Promise<void> {
		try {
			const db = getDbInstance();
			const rawDb = getRawDbInstance();
			
			// Clean up stale PROCESSING tweets (older than 2 minutes)
			// Reduced from 5 minutes for faster recovery after crashes
			await this.resetStaleProcessingTweets();
			
			// Get normally scheduled tweets
			const dueTweets = await (db as any).findDueTweets();
			
			// Also get tweets due for retry (scheduled tweets with nextRetryAt in the past)
			const now = Date.now();
			const retryTweets = rawDb.query(
				`SELECT * FROM tweets 
				 WHERE status = ? 
				 AND nextRetryAt IS NOT NULL 
				 AND nextRetryAt <= ?
				 AND (retryCount IS NULL OR retryCount < COALESCE(maxRetries, ?))`,
				[TweetStatus.SCHEDULED, now, DEFAULT_MAX_RETRIES]
			) || [];
			
			// Combine and deduplicate by ID
			const allTweets = [...dueTweets];
			const existingIds = new Set(dueTweets.map((t: any) => t.id));
			for (const retryTweet of retryTweets) {
				if (!existingIds.has(retryTweet.id)) {
					allTweets.push(retryTweet);
				}
			}

			if (allTweets.length === 0) {
				return;
			}

			log.info('Processing due tweets', { 
				total: allTweets.length,
				scheduled: dueTweets.length,
				retries: retryTweets.length 
			});

			// Pre-fetch all accounts for username lookup in error handlers
			const allAccounts = await db.getAllUserAccounts();

			for (const tweet of allTweets) {
				// Get account info for this tweet (used in notifications)
				const tweetAccount = allAccounts.find((acc: any) => acc.providerAccountId === tweet.twitterAccountId);
				const accountUsername = tweetAccount?.username;

				try {
					// Idempotency check: Skip if already posted
					if (tweet.twitterTweetId) {
						log.warn('Tweet already has twitterTweetId, skipping', {
							tweetId: tweet.id,
							twitterTweetId: tweet.twitterTweetId
						});
						// Mark as POSTED if not already
						if (tweet.status !== TweetStatus.POSTED) {
							await db.updateTweetStatus(tweet.id, TweetStatus.POSTED);
						}
						continue;
					}
					
					// Atomically claim the tweet for processing
					// This prevents race conditions where multiple scheduler instances
					// or overlapping intervals try to process the same tweet
					const claimed = this.claimTweetForProcessing(tweet.id);
					if (!claimed) {
						log.info('Tweet already claimed by another process, skipping', {
							tweetId: tweet.id
						});
						continue;
					}
					
					await this.postTweet(tweet);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					const currentRetryCount = tweet.retryCount || 0;
					const maxRetries = tweet.maxRetries ?? DEFAULT_MAX_RETRIES;
					
					log.error('Failed to post scheduled tweet', {
						tweetId: tweet.id,
						error: errorMessage,
						retryCount: currentRetryCount,
						maxRetries,
						account: accountUsername
					});

					// Check if we should retry
					if (currentRetryCount < maxRetries) {
						const nextRetryAt = this.calculateNextRetryTime(currentRetryCount);
						
						log.info('Scheduling tweet for retry', {
							tweetId: tweet.id,
							retryCount: currentRetryCount + 1,
							maxRetries,
							nextRetryAt
						});

						// Schedule for retry with exponential backoff
						const rawDb = getRawDbInstance();
						rawDb.execute(
							`UPDATE tweets SET 
								status = ?, 
								retryCount = ?, 
								lastError = ?, 
								nextRetryAt = ?,
								updatedAt = ?
							WHERE id = ?`,
							[
								TweetStatus.SCHEDULED,
								currentRetryCount + 1,
								errorMessage,
								nextRetryAt.getTime(),
								Date.now(),
								tweet.id
							]
						);

						// Send email notification for retry
						emailNotificationService.notifyTweetFailed(
							tweet.userId,
							tweet.id!,
							tweet.content,
							errorMessage,
							currentRetryCount + 1,
							maxRetries
						).catch(err => log.error('Failed to send tweet retry notification', { error: err }));

						// Send push notification for retry
						pushNotificationService.notifyTweetFailed(
							tweet.userId,
							tweet.id!,
							`Retry ${currentRetryCount + 1}/${maxRetries}: ${errorMessage}`,
							accountUsername
						).catch(err => log.error('Failed to send push notification for tweet retry', { error: err }));
					} else {
						// Max retries exceeded, mark as permanently failed
						log.warn('Max retries exceeded for tweet, marking as failed', {
							tweetId: tweet.id,
							retryCount: currentRetryCount,
							maxRetries
						});
						
						const rawDb = getRawDbInstance();
						rawDb.execute(
							`UPDATE tweets SET 
								status = ?, 
								lastError = ?,
								updatedAt = ?
							WHERE id = ?`,
							[
								TweetStatus.FAILED,
								`Max retries (${maxRetries}) exceeded. Last error: ${errorMessage}`,
								Date.now(),
								tweet.id
							]
						);

						// Send email notification for max retries exceeded
						emailNotificationService.notifyMaxRetriesExceeded(
							tweet.userId,
							tweet.id!,
							tweet.content,
							errorMessage
						).catch(err => log.error('Failed to send max retries notification', { error: err }));

						// Send push notification for permanent failure
						pushNotificationService.notifyTweetFailed(
							tweet.userId,
							tweet.id!,
							`Max retries exceeded: ${errorMessage}`,
							accountUsername
						).catch(err => log.error('Failed to send push notification for max retries', { error: err }));
					}
				}
			}
		} catch (error) {
			log.error('Error processing due tweets', { error });
		}
	}

	/**
	 * Reset tweets stuck in PROCESSING status for more than 5 minutes
	 * This handles cases where the scheduler crashed while processing
	 * Uses direct SQL query for efficiency instead of fetching all tweets
	 */
	private async resetStaleProcessingTweets(): Promise<void> {
		try {
			const rawDb = getRawDbInstance();
			// Reduced from 5 minutes to 2 minutes for faster recovery
			const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
			
			// First, find stale tweets using efficient SQL query
			const staleTweets = rawDb.query(
				`SELECT id FROM tweets 
				 WHERE status = ? 
				 AND updatedAt IS NOT NULL 
				 AND updatedAt < ?`,
				[TweetStatus.PROCESSING, twoMinutesAgo]
			);
			
			if (staleTweets && staleTweets.length > 0) {
				const tweetIds = staleTweets.map((t: any) => t.id);
				
				log.warn('Found stale PROCESSING tweets, resetting to SCHEDULED', {
					count: staleTweets.length,
					tweetIds
				});
				
				// Batch update all stale tweets in a single query
				const placeholders = tweetIds.map(() => '?').join(',');
				rawDb.execute(
					`UPDATE tweets SET status = ?, updatedAt = ? WHERE id IN (${placeholders})`,
					[TweetStatus.SCHEDULED, Date.now(), ...tweetIds]
				);
			}
		} catch (error) {
			log.error('Error resetting stale processing tweets', { error });
		}
	}

	/**
	 * Post a single tweet to Twitter
	 */
	private async postTweet(tweet: Tweet): Promise<void> {
		const db = getDbInstance();
		
		// Double-check tweet hasn't been posted (additional safety)
		if (tweet.twitterTweetId) {
			log.warn('Tweet already posted, skipping', {
				tweetId: tweet.id,
				twitterTweetId: tweet.twitterTweetId
			});
			return;
		}

		// Get the account for this tweet
		const accounts = await db.getAllUserAccounts();
		const account = accounts.find((acc: any) => acc.providerAccountId === tweet.twitterAccountId);

		if (!account) {
			throw new Error(`Account not found for tweet: ${tweet.twitterAccountId}`);
		}

		// Get Twitter app configuration
		const twitterApp = await db.getTwitterApp(account.twitterAppId);
		if (!twitterApp) {
			throw new Error('Twitter app configuration not found');
		}

		// Get authenticated client with automatic token refresh
		const twitterAuth = TwitterAuthService.getInstance();
		const { client: twitterClient } = await twitterAuth.getAuthenticatedClient(
			account,
			twitterApp
		);

		// Prepare tweet data
		const tweetData: any = {
			text: tweet.content
		};

		// Handle media if present
		if (tweet.media && tweet.media.length > 0) {
			// Check if OAuth 1.0a credentials are available for media uploads
			const hasOAuth1Credentials =
				(twitterApp as any).consumerKey &&
				(twitterApp as any).consumerSecret &&
				(twitterApp as any).accessToken &&
				(twitterApp as any).accessTokenSecret;

			if (hasOAuth1Credentials) {
				const mediaIds: string[] = [];

				// Create OAuth 1.0a client for media uploads
				const oauth1Client = new TwitterApi({
					appKey: (twitterApp as any).consumerKey!,
					appSecret: (twitterApp as any).consumerSecret!,
					accessToken: (twitterApp as any).accessToken!,
					accessSecret: (twitterApp as any).accessTokenSecret!
				});

				for (const mediaItem of tweet.media) {
					try {
						// Read media from filesystem
						// mediaItem.url is like "/uploads/filename.gif"
						const filename = mediaItem.url.replace('/uploads/', '');
						// In Docker, uploads are at /app/packages/schedx-app/uploads
						// In dev, they're at process.cwd()/uploads
						const uploadsDir = process.env.DOCKER === 'true'
							? '/app/packages/schedx-app/uploads'
							: path.join(process.cwd(), 'uploads');
						const filepath = path.join(uploadsDir, filename);
						
						log.debug('Reading media file for scheduled tweet', {
							tweetId: tweet.id,
							mediaUrl: mediaItem.url,
							filepath
						});
						
						const buffer = readFileSync(filepath);

						// Determine media type based on file extension for accuracy
						const ext = filename.split('.').pop()?.toLowerCase() || '';
						let twitterMediaType: string;
						
						if (mediaItem.type === 'video') {
							// Map video extensions to proper MIME types
							switch (ext) {
								case 'webm':
									twitterMediaType = 'video/webm';
									break;
								case 'mov':
									twitterMediaType = 'video/quicktime';
									break;
								case 'mp4':
								default:
									twitterMediaType = 'video/mp4';
									break;
							}
						} else if (mediaItem.type === 'gif') {
							twitterMediaType = 'image/gif';
						} else {
							// Map image extensions to proper MIME types
							switch (ext) {
								case 'png':
									twitterMediaType = 'image/png';
									break;
								case 'gif':
									twitterMediaType = 'image/gif';
									break;
								case 'webp':
									twitterMediaType = 'image/webp';
									break;
								case 'jpg':
								case 'jpeg':
								default:
									twitterMediaType = 'image/jpeg';
									break;
							}
						}

						// Upload media using OAuth 1.0a client
						const mediaId = await oauth1Client.v1.uploadMedia(buffer, {
							mimeType: twitterMediaType
						});

						mediaIds.push(mediaId);
						
						log.debug('Media uploaded successfully for scheduled tweet', {
							tweetId: tweet.id,
							mediaId
						});
					} catch (mediaError) {
						log.error('Failed to upload media for scheduled tweet', {
							tweetId: tweet.id,
							mediaUrl: mediaItem.url,
							error: mediaError instanceof Error ? mediaError.message : 'Unknown error'
						});
						// Continue without this media item
					}
				}

				if (mediaIds.length > 0) {
					tweetData.media = { media_ids: mediaIds };
				}
			} else {
				log.warn('OAuth 1.0a credentials not available, skipping media upload', {
					tweetId: tweet.id
				});
			}
		}

		// Post the tweet
		const postedTweet = await twitterClient.v2.tweet(tweetData);

		if (!postedTweet.data) {
			throw new Error('No tweet data returned from Twitter API');
		}

		// Update tweet in database
		await db.updateTweet(tweet.id!, {
			status: TweetStatus.POSTED,
			twitterTweetId: postedTweet.data.id,
			updatedAt: new Date()
		});

		log.info('Scheduled tweet posted successfully', {
			tweetId: tweet.id,
			twitterTweetId: postedTweet.data.id,
			username: account.username
		});

		// Send email notification for successful post
		const tweetUrl = `https://twitter.com/${account.username}/status/${postedTweet.data.id}`;
		emailNotificationService.notifyTweetPosted(
			tweet.userId,
			tweet.id!,
			tweet.content,
			tweetUrl
		).catch(err => log.error('Failed to send tweet posted notification', { error: err }));

		// Send push notification for successful post
		pushNotificationService.notifyTweetPosted(
			tweet.userId,
			tweet.id!,
			tweetUrl,
			account.username
		).catch(err => log.error('Failed to send push notification for posted tweet', { error: err }));

		// Handle recurrence if configured
		if (tweet.recurrenceType && tweet.recurrenceInterval) {
			await this.handleRecurrence(tweet);
		}
	}

	/**
	 * Handle recurring tweets by creating a new scheduled tweet
	 */
	private async handleRecurrence(tweet: Tweet): Promise<void> {
		const db = getDbInstance();

		// Calculate next scheduled date based on recurrence type
		const nextDate = new Date(tweet.scheduledDate);

		switch (tweet.recurrenceType) {
			case 'daily':
				nextDate.setDate(nextDate.getDate() + (tweet.recurrenceInterval || 1));
				break;
			case 'weekly':
				nextDate.setDate(nextDate.getDate() + 7 * (tweet.recurrenceInterval || 1));
				break;
			case 'monthly':
				nextDate.setMonth(nextDate.getMonth() + (tweet.recurrenceInterval || 1));
				break;
		}

		// Check if we've passed the end date
		if (tweet.recurrenceEndDate && nextDate > tweet.recurrenceEndDate) {
			log.info('Recurrence ended for tweet', { tweetId: tweet.id });
			return;
		}

		// Create new scheduled tweet
		const newTweet: Tweet = {
			...tweet,
			id: undefined as any, // Will be generated
			scheduledDate: nextDate,
			status: TweetStatus.SCHEDULED,
			twitterTweetId: undefined,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		await db.saveTweet(newTweet);

		log.info('Created recurring tweet', {
			originalTweetId: tweet.id,
			nextScheduledDate: nextDate
		});
	}
}
