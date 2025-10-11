import { getDbInstance } from './db';
import { TwitterAuthService } from './twitterAuth';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import type { Tweet } from '@schedx/shared-lib/types/types';
import { log } from './logger';
import { TwitterApi } from 'twitter-api-v2';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Tweet Scheduler Service
 * Processes scheduled tweets and posts them to Twitter
 */
export class TweetSchedulerService {
	private static instance: TweetSchedulerService;
	private isRunning = false;
	private intervalId: NodeJS.Timeout | null = null;

	private constructor() {}

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
	 * Process all tweets that are due to be posted
	 */
	private async processDueTweets(): Promise<void> {
		try {
			const db = getDbInstance();
			const dueTweets = await (db as any).findDueTweets();

			if (dueTweets.length === 0) {
				return;
			}

			log.info('Processing due tweets', { count: dueTweets.length });

			for (const tweet of dueTweets) {
				try {
					await this.postTweet(tweet);
				} catch (error) {
					log.error('Failed to post scheduled tweet', {
						tweetId: tweet.id,
						error: error instanceof Error ? error.message : 'Unknown error'
					});

					// Mark tweet as failed
					await db.updateTweet(tweet.id, {
						status: TweetStatus.FAILED,
						updatedAt: new Date()
					});
				}
			}
		} catch (error) {
			log.error('Error processing due tweets', { error });
		}
	}

	/**
	 * Post a single tweet to Twitter
	 */
	private async postTweet(tweet: Tweet): Promise<void> {
		const db = getDbInstance();

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

						// Determine media type
						const twitterMediaType =
							mediaItem.type === 'video'
								? 'video/mp4'
								: mediaItem.type === 'gif'
									? 'image/gif'
									: 'image/jpeg';

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
