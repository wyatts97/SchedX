import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRawDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * POST /api/tweets/:id/refresh-stats
 * Refresh engagement stats for a specific tweet
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

		// Get the tweet from database to verify ownership
		const tweet = rawDb.queryOne(
			'SELECT id, userId, likeCount, retweetCount, replyCount, impressionCount, bookmarkCount FROM tweets WHERE id = ?',
			[id]
		);

		if (!tweet) {
			throw error(404, 'Tweet not found');
		}

		if (tweet.userId !== user.id) {
			throw error(403, 'Forbidden');
		}

		logger.debug({ tweetId: id, userId: user.id }, 'Tweet stats refresh requested');

		// Note: Rettiwt integration removed - return current cached stats
		return json({
			success: false,
			message: 'Real-time stats refresh not available. Stats shown are from last post.',
			stats: {
				likeCount: tweet.likeCount || 0,
				retweetCount: tweet.retweetCount || 0,
				replyCount: tweet.replyCount || 0,
				impressionCount: tweet.impressionCount || 0,
				bookmarkCount: tweet.bookmarkCount || 0
			},
			cached: true
		});
	} catch (err: any) {
		logger.error({ error: err, tweetId: id, userId: user.id }, 'Failed to refresh tweet stats');
		
		if (err.status) {
			throw err;
		}
		
		throw error(500, 'Failed to refresh tweet stats');
	}
};
