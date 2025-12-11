import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

// Helper to get user ID from session
async function getUserIdFromSession(adminSession: string): Promise<string | null> {
	const db = getDbInstance();
	const session = await db.getSession(adminSession);
	return session?.data?.user?.id || null;
}

export const GET: RequestHandler = async ({ cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const userId = await getUserIdFromSession(adminSession);
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = getDbInstance();
		// Get all tweets
		const tweets = await (db as any).getAllTweets(userId);

		// Format tweets for display
		const formattedTweets = tweets.map((tweet: any) => ({
			id: tweet._id?.toString() || tweet.id,
			content: tweet.content,
			scheduledDate: tweet.scheduledDate,
			status: tweet.status,
			twitterAccountId: tweet.twitterAccountId,
			twitterTweetId: tweet.twitterTweetId,
			createdAt: tweet.createdAt,
			updatedAt: tweet.updatedAt,
			media: tweet.media || [],
			likeCount: tweet.likeCount || 0,
			retweetCount: tweet.retweetCount || 0,
			replyCount: tweet.replyCount || 0,
			impressionCount: tweet.impressionCount || 0,
			bookmarkCount: tweet.bookmarkCount || 0
		}));

		return json({
			tweets: formattedTweets
		}, { headers: { 'cache-control': 'no-cache' } });
	} catch (error) {
		logger.error('Error fetching tweets');
		return json({ error: 'Failed to fetch tweets' }, { status: 500 });
	}
};
