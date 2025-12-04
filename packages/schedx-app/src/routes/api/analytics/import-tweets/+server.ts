import { json, type RequestEvent } from '@sveltejs/kit';
import { RettiwtService } from '$lib/server/rettiwtService';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import { clearAnalyticsCache } from '$lib/server/analytics/cache';
import crypto from 'crypto';

/**
 * POST /api/analytics/import-tweets
 * Import tweets from Twitter for a specific date range
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json();
		const { username, daysBack = 30, maxTweets = 500 } = body;

		if (!username) {
			return json({ error: 'Username is required' }, { status: 400 });
		}

		logger.info({ userId, username, daysBack, maxTweets }, 'Importing tweets from Twitter with pagination');

		// Fetch tweets from Twitter using paginated method
		const tweets = await RettiwtService.getUserTweetsPaginated(username, userId, {
			maxTweets,
			daysBack,
			batchSize: 20,
			delayMs: 500
		});

		logger.debug({ tweetCount: tweets.length }, 'Fetched tweets from Twitter');

		// Get database instance
		const db = getDbInstance();

		// Get the user's Twitter account
		const account = (db as any)['db'].queryOne(
			'SELECT id, providerAccountId FROM accounts WHERE userId = ? AND username = ? AND provider = ?',
			[userId, username, 'twitter']
		);

		if (!account) {
			return json({ error: 'Twitter account not found' }, { status: 404 });
		}

		let imported = 0;
		let skipped = 0;
		let updated = 0;

		// Import each tweet
		for (const tweet of tweets) {
			try {
				// Check if tweet already exists
				const existing = (db as any)['db'].queryOne(
					'SELECT id, likeCount, retweetCount, replyCount, impressionCount FROM tweets WHERE twitterTweetId = ?',
					[tweet.id]
				);

				if (existing) {
					// Update engagement metrics if they've changed
					const hasChanges = 
						existing.likeCount !== tweet.likeCount ||
						existing.retweetCount !== tweet.retweetCount ||
						existing.replyCount !== tweet.replyCount ||
						existing.impressionCount !== tweet.viewCount;

					if (hasChanges) {
						(db as any)['db'].execute(
							`UPDATE tweets 
							 SET likeCount = ?, retweetCount = ?, replyCount = ?, impressionCount = ?, updatedAt = ?
							 WHERE id = ?`,
							[tweet.likeCount, tweet.retweetCount, tweet.replyCount, tweet.viewCount, Date.now(), existing.id]
						);
						updated++;
						logger.debug({ tweetId: tweet.id }, 'Updated existing tweet engagement');
					} else {
						skipped++;
					}
					continue;
				}

				// Import new tweet
				const tweetId = crypto.randomUUID();
				const now = Date.now();

				(db as any)['db'].execute(
					`INSERT INTO tweets (
						id, userId, twitterAccountId, content, scheduledDate, 
						status, twitterTweetId, createdAt, updatedAt,
						likeCount, retweetCount, replyCount, impressionCount, media
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						tweetId,
						userId,
						account.providerAccountId,
						tweet.text,
						new Date(tweet.createdAt).getTime(),
						'imported', // Use 'imported' status so they don't show in Published Tweets tab
						tweet.id,
						new Date(tweet.createdAt).getTime(),
						now,
						tweet.likeCount,
						tweet.retweetCount,
						tweet.replyCount,
						tweet.viewCount,
						JSON.stringify(tweet.media || [])
					]
				);

				imported++;
				logger.debug({ tweetId: tweet.id }, 'Imported new tweet');
			} catch (error: any) {
				logger.error({ 
					error, 
					errorMessage: error.message,
					errorCode: error.code,
					tweetId: tweet.id,
					accountId: account.providerAccountId,
					userId: userId
				}, 'Failed to import tweet');
				skipped++;
			}
		}

		logger.info({ imported, updated, skipped }, 'Tweet import completed');

		// Clear analytics cache so Overview Tab shows fresh data
		clearAnalyticsCache(userId);
		logger.debug({ userId }, 'Analytics cache cleared after import');

		return json({
			success: true,
			message: `Imported ${imported} new tweets, updated ${updated}, skipped ${skipped}`,
			stats: {
				imported,
				updated,
				skipped,
				fetched: tweets.length,
				total: imported + updated + skipped
			}
		});
	} catch (error) {
		logger.error({ error }, 'Failed to import tweets');
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to import tweets' },
			{ status: 500 }
		);
	}
};
