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

		// Get analytics data
		const tweets = await (db as any).getAllTweets();
		const accounts = await (db as any).getAllUserAccounts();

		// Calculate basic analytics
		const totalTweets = tweets.length;
		const postedTweets = tweets.filter((t: any) => t.status === 'POSTED').length;
		const scheduledTweets = tweets.filter((t: any) => t.status === 'SCHEDULED').length;
		const failedTweets = tweets.filter((t: any) => t.status === 'FAILED').length;
		const successRate = totalTweets > 0 ? Math.round((postedTweets / totalTweets) * 100) : 0;

		// Get recent activity (last 10 tweets)
		const recentActivity = tweets
			.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
			.slice(0, 10)
			.map((tweet: any) => ({
				message: `Tweet ${tweet.status.toLowerCase()}: ${tweet.content.substring(0, 50)}...`,
				time: new Date(tweet.createdAt).toLocaleString()
			}));

		// Get recent errors (failed tweets)
		const errors = tweets
			.filter((t: any) => t.status === 'FAILED')
			.slice(0, 5)
			.map((tweet: any) => ({
				message: tweet.error || 'Unknown error',
				time: new Date(tweet.createdAt).toLocaleString()
			}));

		return json({
			analytics: {
				totalTweets,
				postedTweets,
				scheduledTweets,
				failedTweets,
				successRate,
				totalAccounts: accounts.length,
				recentActivity,
				errors
			}
		});
	} catch (error) {
		logger.error('Error fetching analytics');
		return json({ error: 'Failed to fetch analytics' }, { status: 500 });
	}
};
