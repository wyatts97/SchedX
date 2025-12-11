import { getDbInstance } from './db';
import { TwitterAuthService } from './twitterAuth';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from './logger';
import { TwitterApi } from 'twitter-api-v2';

/**
 * Thread Scheduler Service
 * Processes scheduled threads and posts them to Twitter
 */
export class ThreadSchedulerService {
	private static instance: ThreadSchedulerService;
	private isRunning = false;
	private intervalId: NodeJS.Timeout | null = null;

	private constructor() {}

	public static getInstance(): ThreadSchedulerService {
		if (!ThreadSchedulerService.instance) {
			ThreadSchedulerService.instance = new ThreadSchedulerService();
		}
		return ThreadSchedulerService.instance;
	}

	/**
	 * Start the scheduler
	 * Checks for due threads every minute
	 */
	public start(intervalMs: number = 60000): void {
		if (this.isRunning) {
			log.warn('Thread scheduler already running');
			return;
		}

		this.isRunning = true;
		log.info('Thread scheduler started', { intervalMs });

		// Run immediately on start
		this.processDueThreads().catch((error) => {
			log.error('Error in initial thread scheduler run', { error });
		});

		// Then run on interval
		this.intervalId = setInterval(() => {
			this.processDueThreads().catch((error) => {
				log.error('Error in thread scheduler interval', { error });
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
		log.info('Thread scheduler stopped');
	}

	/**
	 * Process all threads that are due to be posted
	 */
	private async processDueThreads(): Promise<void> {
		try {
			const db = getDbInstance();
			
			// Clean up stale PROCESSING threads
			await this.resetStaleProcessingThreads();
			
			// Get first admin user (role='admin')
			const user = await (db as any).getFirstAdminUser();
			if (!user) {
				return;
			}

			// Get all scheduled threads
			const threads = await db.getThreads(user.id, TweetStatus.SCHEDULED);
			
			// Filter to only due threads
			const now = new Date();
			const dueThreads = threads.filter((thread: any) => {
				return thread.scheduledDate && new Date(thread.scheduledDate) <= now;
			});

			if (dueThreads.length === 0) {
				return;
			}

			log.info('Processing due threads', { count: dueThreads.length });

			for (const thread of dueThreads) {
				try {
					// Idempotency check: Skip if already posted
					if (thread.twitterThreadId) {
						log.warn('Thread already has twitterThreadId, skipping', {
							threadId: thread.id,
							twitterThreadId: thread.twitterThreadId
						});
						if (thread.status !== TweetStatus.POSTED) {
							await db.updateThreadStatus(thread.id, TweetStatus.POSTED, thread.twitterThreadId);
						}
						continue;
					}
					
					// Mark as PROCESSING immediately to prevent race conditions
					await db.updateThreadStatus(thread.id, TweetStatus.PROCESSING);
					
					await this.postThread(thread);
				} catch (error) {
					log.error('Failed to post scheduled thread', {
						threadId: thread.id,
						error: error instanceof Error ? error.message : 'Unknown error'
					});

					// Mark thread as failed
					await db.updateThreadStatus(thread.id, TweetStatus.FAILED);
				}
			}
		} catch (error) {
			log.error('Error processing due threads', { error });
		}
	}

	/**
	 * Reset threads stuck in PROCESSING status for more than 5 minutes
	 */
	private async resetStaleProcessingThreads(): Promise<void> {
		const db = getDbInstance();
		try {
			const user = await (db as any).getFirstAdminUser();
			if (!user) return;
			
			const allThreads = await db.getThreads(user.id);
			const now = Date.now();
			const fiveMinutesAgo = now - 5 * 60 * 1000;
			
			const staleThreads = allThreads.filter((t: any) => 
				t.status === TweetStatus.PROCESSING && 
				t.updatedAt && 
				new Date(t.updatedAt).getTime() < fiveMinutesAgo
			);
			
			if (staleThreads.length > 0) {
				log.warn('Found stale PROCESSING threads, resetting to SCHEDULED', {
					count: staleThreads.length,
					threadIds: staleThreads.map((t: any) => t.id)
				});
				
				for (const thread of staleThreads) {
					await db.updateThreadStatus(thread.id, TweetStatus.SCHEDULED);
				}
			}
		} catch (error) {
			log.error('Error resetting stale processing threads', { error });
		}
	}

	/**
	 * Post a thread to Twitter
	 */
	private async postThread(thread: any): Promise<void> {
		const db = getDbInstance();
		
		// Double-check thread hasn't been posted
		if (thread.twitterThreadId) {
			log.warn('Thread already posted, skipping', {
				threadId: thread.id,
				twitterThreadId: thread.twitterThreadId
			});
			return;
		}

		// Get the account for this thread
		const accounts = await db.getAllUserAccounts();
		const account = accounts.find((acc: any) => acc.providerAccountId === thread.twitterAccountId);

		if (!account) {
			throw new Error(`Account not found for thread: ${thread.twitterAccountId}`);
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

		// Check if OAuth 1.0a credentials are available for media uploads
		const hasOAuth1Credentials =
			(twitterApp as any).consumerKey &&
			(twitterApp as any).consumerSecret &&
			(twitterApp as any).accessToken &&
			(twitterApp as any).accessTokenSecret;

		let oauth1Client: any = null;
		if (hasOAuth1Credentials) {
			oauth1Client = new TwitterApi({
				appKey: (twitterApp as any).consumerKey!,
				appSecret: (twitterApp as any).consumerSecret!,
				accessToken: (twitterApp as any).accessToken!,
				accessSecret: (twitterApp as any).accessTokenSecret!
			});
		}

		// Post tweets in sequence, each replying to the previous
		const tweetIds: string[] = [];
		let previousTweetId: string | undefined = undefined;

		for (let i = 0; i < thread.tweets.length; i++) {
			const tweetContent = thread.tweets[i];
			
			try {
				// Prepare tweet data
				const tweetData: any = {
					text: tweetContent.content
				};

				// Add reply reference if not the first tweet
				if (previousTweetId) {
					tweetData.reply = {
						in_reply_to_tweet_id: previousTweetId
					};
				}

				// Handle media if present
				if (tweetContent.media && tweetContent.media.length > 0 && oauth1Client) {
					const mediaIds: string[] = [];

					for (const mediaItem of tweetContent.media) {
						try {
							// Fetch media from URL
							const response = await fetch(mediaItem.url);
							const buffer = await response.arrayBuffer();

							// Determine media type
							const twitterMediaType =
								mediaItem.type === 'video'
									? 'video/mp4'
									: mediaItem.type === 'gif'
										? 'image/gif'
										: 'image/jpeg';

							// Upload media using OAuth 1.0a client
							const mediaId = await oauth1Client.v1.uploadMedia(Buffer.from(buffer), {
								mimeType: twitterMediaType
							});

							mediaIds.push(mediaId);
						} catch (mediaError) {
							log.error('Failed to upload media for thread tweet', {
								threadId: thread.id,
								tweetPosition: i + 1,
								mediaUrl: mediaItem.url,
								error: mediaError instanceof Error ? mediaError.message : 'Unknown error'
							});
							// Continue without this media item
						}
					}

					if (mediaIds.length > 0) {
						tweetData.media = { media_ids: mediaIds };
					}
				}

				// Post the tweet
				const postedTweet = await twitterClient.v2.tweet(tweetData);

				if (!postedTweet.data) {
					throw new Error(`No tweet data returned for tweet ${i + 1} in thread`);
				}

				tweetIds.push(postedTweet.data.id);
				previousTweetId = postedTweet.data.id;

				log.info('Thread tweet posted', {
					threadId: thread.id,
					position: i + 1,
					total: thread.tweets.length,
					twitterTweetId: postedTweet.data.id
				});

				// Small delay between tweets to avoid rate limits
				if (i < thread.tweets.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 2000));
				}
			} catch (error) {
				log.error('Failed to post tweet in thread', {
					threadId: thread.id,
					position: i + 1,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
				throw error; // Fail the entire thread if one tweet fails
			}
		}

		// Update thread in database with first tweet ID
		await db.updateThreadStatus(thread.id, TweetStatus.POSTED, tweetIds[0]);

		log.info('Thread posted successfully', {
			threadId: thread.id,
			tweetCount: tweetIds.length,
			firstTweetId: tweetIds[0],
			username: account.username
		});
	}
}
