import { Rettiwt } from 'rettiwt-api';
import logger from '$lib/server/logger';
import { CookieEncryption } from './cookieEncryption';
import { getDbInstance } from './db';

/**
 * Service for interacting with Twitter/X via Rettiwt-API
 * Supports both public (unauthenticated) and authenticated (API key-based) access
 */
export class RettiwtService {
	/**
	 * Creates a Rettiwt instance for a specific user
	 * If the user has a stored Rettiwt API key, it will be used for authenticated access
	 * @param userId - The user ID to fetch API key for
	 * @returns Rettiwt instance
	 */
	public static async createInstance(userId?: string): Promise<Rettiwt> {
		if (!userId) {
			// Return public instance without authentication
			logger.debug('Creating public Rettiwt instance');
			return new Rettiwt();
		}

		try {
			const db = getDbInstance();
			
			// Get API key from any of the user's Twitter accounts
			const account = (db as any)['db'].queryOne(
				'SELECT rettiwt_api_key FROM accounts WHERE userId = ? AND provider = ? AND rettiwt_api_key IS NOT NULL LIMIT 1',
				[userId, 'twitter']
			);

			if (account?.rettiwt_api_key) {
				// Decrypt the stored API key
				const decryptedApiKey = CookieEncryption.decrypt(account.rettiwt_api_key);
				
				logger.debug({ userId }, 'Creating authenticated Rettiwt instance with user API key');
				
				// Create authenticated instance with API key
				return new Rettiwt({
					apiKey: decryptedApiKey
				});
			}

			// No API key stored, return public instance
			logger.debug({ userId }, 'No API key found, creating public Rettiwt instance');
			return new Rettiwt();
		} catch (error) {
			logger.error({ error, userId }, 'Failed to create Rettiwt instance, falling back to public mode');
			return new Rettiwt();
		}
	}

	/**
	 * Fetches user analytics for a Twitter username
	 * @param username - Twitter username (without @)
	 * @param userId - Optional user ID for authenticated access
	 * @returns Analytics data
	 */
	public static async getUserAnalytics(username: string, userId?: string) {
		try {
			const rettiwt = await this.createInstance(userId);

			logger.debug({ username, userId }, 'Fetching user analytics');

			// First, get user details with username to retrieve the numeric ID
			let userDetails;
			try {
				userDetails = await rettiwt.user.details(username);
			} catch (detailsError: any) {
				if (detailsError.message?.toLowerCase().includes('rate limit')) {
					throw new Error('Twitter API rate limit exceeded. Please try again later.');
				}
				if (detailsError.message?.toLowerCase().includes('not found') || detailsError.status === 404) {
					throw new Error(`Twitter user @${username} not found`);
				}
				throw detailsError;
			}
			
			if (!userDetails || !userDetails.id) {
				throw new Error(`Twitter user @${username} not found`);
			}

			logger.debug({ username, twitterUserId: userDetails.id }, 'Retrieved Twitter user ID');

			// Fetch recent tweets using user.timeline() with NUMERIC ID
			// The Rettiwt API requires numeric ID for timeline(), not username
			const timelineData = await rettiwt.user.timeline(userDetails.id, 20);

			// Extract tweet list from the response
			const tweetList = timelineData?.list || [];
			
			// Calculate engagement metrics
			const totalLikes = tweetList.reduce((sum: number, tweet: any) => sum + (tweet.likeCount || 0), 0);
			const totalRetweets = tweetList.reduce((sum: number, tweet: any) => sum + (tweet.retweetCount || 0), 0);
			const totalReplies = tweetList.reduce((sum: number, tweet: any) => sum + (tweet.replyCount || 0), 0);
			const totalViews = tweetList.reduce((sum: number, tweet: any) => sum + (tweet.viewCount || 0), 0);

			const avgEngagement = tweetList.length > 0
				? (totalLikes + totalRetweets + totalReplies) / tweetList.length
				: 0;

			// Get high-resolution profile image
			// Twitter profile images can be requested in different sizes:
			// _normal (48x48), _bigger (73x73), _200x200, _400x400, or original (remove size suffix)
			let profileImageUrl = userDetails.profileImage || '';
			if (profileImageUrl) {
				// Replace _normal or other size suffixes with _400x400 for higher quality
				profileImageUrl = profileImageUrl
					.replace(/_normal\./, '_400x400.')
					.replace(/_bigger\./, '_400x400.')
					.replace(/_200x200\./, '_400x400.');
			}

			// Calculate engagement rate: (likes + retweets + replies) / followers * 100
			const totalEngagement = totalLikes + totalRetweets + totalReplies;
			const engagementRate = userDetails.followersCount > 0 
				? (totalEngagement / userDetails.followersCount) * 100 
				: 0;

			return {
				username: userDetails.userName,
				displayName: userDetails.fullName,
				followers: userDetails.followersCount,
				following: userDetails.followingsCount,
				tweetsCount: userDetails.statusesCount,
				profileImage: profileImageUrl,
				profileBanner: userDetails.profileBanner || '',
				bio: userDetails.description || '',
				verified: userDetails.isVerified,
				createdAt: userDetails.createdAt || '',
				recentTweets: tweetList.length,
				totalLikes,
				totalRetweets,
				totalReplies,
				totalViews,
				avgEngagement: Math.round(avgEngagement * 100) / 100,
				engagementRate: Math.round(engagementRate * 100) / 100
			};
		} catch (error: any) {
			logger.error({ 
				error: {
					message: error?.message,
					status: error?.status,
					code: error?.code,
					name: error?.name,
					details: error?.details,
					stack: error?.stack
				}, 
				username, 
				userId 
			}, 'Failed to fetch user analytics');
			throw error;
		}
	}

	/**
	 * Fetches high-quality profile image for a Twitter user
	 * @param username - Twitter username (without @)
	 * @param userId - Optional user ID for authenticated access
	 * @returns High-quality profile image URL (400x400)
	 */
	public static async getHighQualityProfileImage(username: string, userId?: string): Promise<{
		profileImage: string;
		displayName: string;
	}> {
		try {
			const rettiwt = await this.createInstance(userId);

			logger.debug({ username, userId }, 'Fetching high-quality profile image');

			const userDetails = await rettiwt.user.details(username);

			if (!userDetails) {
				throw new Error(`Twitter user @${username} not found`);
			}

			// Get high-resolution profile image
			// Twitter profile images can be requested in different sizes:
			// _normal (48x48), _bigger (73x73), _200x200, _400x400, or original (remove size suffix)
			let profileImageUrl = userDetails.profileImage || '';
			if (profileImageUrl) {
				// Replace _normal or other size suffixes with _400x400 for higher quality
				profileImageUrl = profileImageUrl
					.replace(/_normal\./, '_400x400.')
					.replace(/_bigger\./, '_400x400.')
					.replace(/_200x200\./, '_400x400.');
			}

			return {
				profileImage: profileImageUrl,
				displayName: userDetails.fullName || username
			};
		} catch (error: any) {
			logger.error({ 
				error: error?.message, 
				username, 
				userId 
			}, 'Failed to fetch high-quality profile image');
			throw error;
		}
	}

	/**
	 * Fetches details for a specific tweet
	 * @param tweetId - Twitter tweet ID
	 * @param userId - Optional user ID for authenticated access
	 * @returns Tweet details
	 */
	public static async getTweetDetails(tweetId: string, userId?: string) {
		try {
			const rettiwt = await this.createInstance(userId);

			logger.debug({ tweetId, userId }, 'Fetching tweet details');

			let tweet;
			try {
				tweet = await rettiwt.tweet.details(tweetId);
			} catch (detailsError: any) {
				if (detailsError.message?.toLowerCase().includes('rate limit')) {
					throw new Error('Twitter API rate limit exceeded. Please try again later.');
				}
				if (detailsError.message?.toLowerCase().includes('not found') || detailsError.status === 404) {
					throw new Error(`Tweet ${tweetId} not found or has been deleted`);
				}
				throw detailsError;
			}

			if (!tweet) {
				throw new Error(`Tweet ${tweetId} not found or has been deleted`);
			}

			return {
				id: tweet.id,
				text: tweet.fullText,
				createdAt: tweet.createdAt,
				likeCount: tweet.likeCount ?? 0,
				retweetCount: tweet.retweetCount ?? 0,
				replyCount: tweet.replyCount ?? 0,
				viewCount: tweet.viewCount ?? 0,
				bookmarkCount: tweet.bookmarkCount ?? 0,
				author: {
					username: tweet.tweetBy?.userName || '',
					displayName: tweet.tweetBy?.fullName || '',
					profileImage: tweet.tweetBy?.profileImage || ''
				},
				media: tweet.media?.map((m: any) => ({
					type: m.type,
					url: m.url
				})) || []
			};
		} catch (error: any) {
			logger.error({ 
				error: {
					message: error?.message,
					status: error?.status,
					code: error?.code,
					name: error?.name,
					details: error?.details,
					stack: error?.stack
				}, 
				tweetId, 
				userId 
			}, 'Failed to fetch tweet details');
			throw error;
		}
	}

	/**
	 * Progress callback for paginated fetching
	 */
	public static onProgress?: (fetched: number, total: number, message: string) => void;

	/**
	 * Fetches tweets from a user's timeline with pagination support
	 * @param username - Twitter username (without @)
	 * @param userId - Optional user ID for authenticated access
	 * @param options - Fetch options
	 * @returns Array of tweets
	 */
	public static async getUserTweets(
		username: string, 
		userId?: string, 
		maxTweets: number = 100,
		daysBack: number = 30
	) {
		return this.getUserTweetsPaginated(username, userId, {
			maxTweets,
			daysBack,
			batchSize: 20,
			delayMs: 500
		});
	}

	/**
	 * Fetches ALL tweets from a user's timeline using cursor pagination
	 * Supports progress callbacks and configurable limits
	 */
	public static async getUserTweetsPaginated(
		username: string,
		userId?: string,
		options: {
			maxTweets?: number;      // Maximum tweets to fetch (default: 500)
			daysBack?: number;       // Stop when reaching this age (default: 90)
			batchSize?: number;      // Tweets per request (max: 20)
			delayMs?: number;        // Delay between requests (default: 500ms)
			onProgress?: (fetched: number, total: number, message: string) => void;
		} = {}
	) {
		const {
			maxTweets = 500,
			daysBack = 90,
			batchSize = 20,
			delayMs = 500,
			onProgress
		} = options;

		try {
			const rettiwt = await this.createInstance(userId);

			logger.info({ username, userId, maxTweets, daysBack }, 'Fetching user tweets with pagination');

			// First, get user details with username to retrieve the numeric ID
			const userDetails = await rettiwt.user.details(username);
			
			if (!userDetails || !userDetails.id) {
				throw new Error('User not found');
			}

			const totalTweetsOnAccount = userDetails.statusesCount || 0;
			const estimatedTotal = Math.min(maxTweets, totalTweetsOnAccount);

			// Calculate cutoff date
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - daysBack);

			const allTweets: any[] = [];
			let cursor: string | undefined;
			let reachedCutoff = false;
			let pageCount = 0;
			const maxPages = Math.ceil(maxTweets / batchSize) + 5; // Safety limit

			while (!reachedCutoff && allTweets.length < maxTweets && pageCount < maxPages) {
				pageCount++;
				
				// Fetch batch with cursor
				const timelineData = await rettiwt.user.timeline(
					userDetails.id,
					batchSize,
					cursor
				);

				const tweets = timelineData?.list || [];
				
				if (tweets.length === 0) {
					logger.debug({ pageCount }, 'No more tweets returned');
					break;
				}

				// Process tweets
				for (const tweet of tweets) {
					const tweetDate = new Date(tweet.createdAt);
					if (tweetDate < cutoffDate) {
						reachedCutoff = true;
						logger.debug({ tweetDate, cutoffDate }, 'Reached date cutoff');
						break;
					}
					
					allTweets.push({
						id: tweet.id,
						text: tweet.fullText,
						createdAt: tweet.createdAt,
						likeCount: tweet.likeCount || 0,
						retweetCount: tweet.retweetCount || 0,
						replyCount: tweet.replyCount || 0,
						viewCount: tweet.viewCount || 0,
						bookmarkCount: tweet.bookmarkCount || 0,
						quoteCount: tweet.quoteCount || 0,
						media: tweet.media?.map((m: any) => ({
							type: m.type,
							url: m.url
						})) || []
					});
					
					if (allTweets.length >= maxTweets) break;
				}

				// Get next cursor for pagination
				// The cursor can be a string directly or an object with a value property
				const nextCursor = timelineData?.next as any;
				cursor = typeof nextCursor === 'string' ? nextCursor : nextCursor?.value;
				
				if (!cursor) {
					logger.debug({ pageCount }, 'No more cursor, reached end of timeline');
					break;
				}

				// Progress callback
				const progressMsg = `Fetched ${allTweets.length} tweets (page ${pageCount})`;
				onProgress?.(allTweets.length, estimatedTotal, progressMsg);
				this.onProgress?.(allTweets.length, estimatedTotal, progressMsg);
				
				logger.debug({ 
					page: pageCount, 
					fetched: allTweets.length, 
					batchSize: tweets.length,
					hasCursor: !!cursor 
				}, 'Pagination progress');

				// Rate limit protection - delay between requests
				if (cursor && allTweets.length < maxTweets && !reachedCutoff) {
					await new Promise(r => setTimeout(r, delayMs));
				}
			}

			logger.info({ 
				username, 
				totalFetched: allTweets.length,
				pages: pageCount,
				reachedCutoff,
				daysBack 
			}, 'Completed paginated tweet fetch');

			return allTweets;
		} catch (error: any) {
			logger.error({ 
				error: {
					message: error?.message,
					status: error?.status,
					code: error?.code,
					name: error?.name,
					details: error?.details,
					stack: error?.stack
				}, 
				username, 
				userId 
			}, 'Failed to fetch user tweets');
			throw error;
		}
	}

	/**
	 * Tests if a Rettiwt API key is valid by attempting to fetch user details
	 * @param apiKey - The Rettiwt API key string to test
	 * @returns true if valid, false otherwise
	 */
	public static async testApiKey(apiKey: string): Promise<boolean> {
		try {
			const rettiwt = new Rettiwt({
				apiKey: apiKey
			});

			// Try to fetch a simple endpoint to verify the API key works
			await rettiwt.user.details('twitter');
			
			return true;
		} catch (error) {
			logger.warn({ error }, 'API key validation failed');
			return false;
		}
	}
}
