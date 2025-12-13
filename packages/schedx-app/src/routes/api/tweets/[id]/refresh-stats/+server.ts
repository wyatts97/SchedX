import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RettiwtService } from '$lib/server/rettiwtService';
import { getRawDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * POST /api/tweets/:id/refresh-stats
 * Refresh engagement stats for a specific tweet from Twitter/X
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	const { id } = params;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	if (!id) {
		throw error(400, 'Tweet ID is required');
	}

	try {
		const rawDb = getRawDbInstance();

		// Get the tweet from database to verify ownership and get twitterTweetId
		const tweet = rawDb.queryOne(
			'SELECT id, twitterTweetId, userId FROM tweets WHERE id = ?',
			[id]
		);

		if (!tweet) {
			throw error(404, 'Tweet not found');
		}

		if (tweet.userId !== user.id) {
			throw error(403, 'Forbidden');
		}

		if (!tweet.twitterTweetId) {
			throw error(400, 'Tweet has not been posted to Twitter yet');
		}

		logger.debug({ tweetId: id, twitterTweetId: tweet.twitterTweetId, userId: user.id }, 'Refreshing tweet stats');

		// Fetch fresh stats from Twitter via Rettiwt
		// Note: Rettiwt public API may fail for:
		// - Very recently posted tweets (not yet indexed)
		// - Some tweets with media attachments
		// - Private/protected accounts
		let tweetDetails;
		try {
			tweetDetails = await RettiwtService.getTweetDetails(tweet.twitterTweetId, user.id);
		} catch (fetchError: any) {
			const errorMsg = fetchError.message || 'Unknown error';
			logger.warn(`Rettiwt API failed for tweet ${tweet.twitterTweetId}: ${errorMsg}`);
			
			// Check if this is a "not found" error - common for new tweets or API limitations
			if (errorMsg.includes('not found') || errorMsg.includes('deleted')) {
				// Return current stats from DB instead of failing
				const currentTweet = rawDb.queryOne(
					`SELECT likeCount, retweetCount, replyCount, impressionCount, bookmarkCount 
					 FROM tweets WHERE id = ?`,
					[id]
				);
				
				return json({
					success: false,
					message: 'Tweet stats unavailable from Twitter API. This can happen for recently posted tweets or due to API limitations. Try again in a few minutes.',
					stats: {
						likeCount: currentTweet?.likeCount || 0,
						retweetCount: currentTweet?.retweetCount || 0,
						replyCount: currentTweet?.replyCount || 0,
						impressionCount: currentTweet?.impressionCount || 0,
						bookmarkCount: currentTweet?.bookmarkCount || 0
					},
					cached: true
				});
			}
			
			// Re-throw other errors
			throw fetchError;
		}
		
		if (!tweetDetails) {
			logger.warn(`Rettiwt returned null for tweet ${tweet.twitterTweetId}`);
			
			// Return cached stats
			const currentTweet = rawDb.queryOne(
				`SELECT likeCount, retweetCount, replyCount, impressionCount, bookmarkCount 
				 FROM tweets WHERE id = ?`,
				[id]
			);
			
			return json({
				success: false,
				message: 'Tweet details not available. The Twitter API may be temporarily unavailable.',
				stats: {
					likeCount: currentTweet?.likeCount || 0,
					retweetCount: currentTweet?.retweetCount || 0,
					replyCount: currentTweet?.replyCount || 0,
					impressionCount: currentTweet?.impressionCount || 0,
					bookmarkCount: currentTweet?.bookmarkCount || 0
				},
				cached: true
			});
		}

		// Update the tweet in database with fresh stats
		rawDb.execute(
			`UPDATE tweets 
			 SET likeCount = ?, 
			     retweetCount = ?, 
			     replyCount = ?, 
			     impressionCount = ?,
			     bookmarkCount = ?,
			     updatedAt = ?
			 WHERE id = ?`,
			[
				tweetDetails.likeCount || 0,
				tweetDetails.retweetCount || 0,
				tweetDetails.replyCount || 0,
				tweetDetails.viewCount || 0,
				tweetDetails.bookmarkCount || 0,
				Date.now(),
				id
			]
		);

		logger.info({ 
			tweetId: id, 
			twitterTweetId: tweet.twitterTweetId,
			likes: tweetDetails.likeCount,
			retweets: tweetDetails.retweetCount,
			replies: tweetDetails.replyCount,
			views: tweetDetails.viewCount,
			bookmarks: tweetDetails.bookmarkCount
		}, 'Tweet stats refreshed successfully');

		return json({
			success: true,
			stats: {
				likeCount: tweetDetails.likeCount || 0,
				retweetCount: tweetDetails.retweetCount || 0,
				replyCount: tweetDetails.replyCount || 0,
				impressionCount: tweetDetails.viewCount || 0,
				bookmarkCount: tweetDetails.bookmarkCount || 0
			}
		});
	} catch (err: any) {
		logger.error({ error: err, tweetId: id, userId: user.id }, 'Failed to refresh tweet stats');
		
		if (err.status) {
			throw err;
		}
		
		if (err.message?.includes('not found')) {
			throw error(404, 'Tweet not found on Twitter');
		}
		
		if (err.message?.includes('rate limit')) {
			throw error(429, 'Rate limit exceeded. Please try again later.');
		}
		
		throw error(500, 'Failed to refresh tweet stats');
	}
};
