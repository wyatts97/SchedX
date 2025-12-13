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
		// Note: Some tweets (especially those with media) may have IDs that need special handling
		let tweetDetails;
		try {
			tweetDetails = await RettiwtService.getTweetDetails(tweet.twitterTweetId, user.id);
		} catch (fetchError: any) {
			logger.error({ 
				error: fetchError.message, 
				tweetId: id, 
				twitterTweetId: tweet.twitterTweetId,
				userId: user.id 
			}, 'Rettiwt API failed to fetch tweet details');
			
			// Re-throw with more context
			throw fetchError;
		}
		
		if (!tweetDetails) {
			logger.warn({ tweetId: id, twitterTweetId: tweet.twitterTweetId }, 'Rettiwt returned null for tweet details');
			throw error(404, 'Tweet details not available from Twitter');
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
