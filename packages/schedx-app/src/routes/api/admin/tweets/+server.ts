import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get all tweets
		const tweets = await (db as any).getAllTweets();

		// Format tweets for display
		const formattedTweets = tweets.map((tweet: any) => ({
			id: tweet._id?.toString() || tweet.id,
			content: tweet.content,
			scheduledDate: tweet.scheduledDate,
			status: tweet.status,
			twitterAccountId: tweet.twitterAccountId,
			twitterTweetId: tweet.twitterTweetId,
			createdAt: tweet.createdAt,
			media: tweet.media || []
		}));

		return json({
			tweets: formattedTweets
		});
	} catch (error) {
		logger.error('Error fetching tweets');
		return json({ error: 'Failed to fetch tweets' }, { status: 500 });
	}
};
