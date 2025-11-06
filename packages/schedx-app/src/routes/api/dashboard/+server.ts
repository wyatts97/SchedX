import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.data.user.id;

		// Batch all database calls in parallel for better performance
		const [appsResult, analyticsResult, tweetsResult, accountsResult] = await Promise.all([
			db.listTwitterApps().catch(() => ([])),
			Promise.resolve(computeAnalytics(db, userId)).catch(() => ({})),
			db.getAllTweets(userId).catch(() => ([])),
			(db as any).getAllUserAccounts().catch(() => ([]))
		]);

		// Transform results to match expected format
		const apps = Array.isArray(appsResult) ? appsResult : [];
		const analytics = analyticsResult || {};
		const tweets = Array.isArray(tweetsResult) ? tweetsResult : [];
		const accounts = Array.isArray(accountsResult) ? accountsResult : [];

		logger.info(`Dashboard batched data loaded: apps=${apps.length}, tweets=${tweets.length}, accounts=${accounts.length}`);

		return json({
			apps: apps || [],
			analytics: analytics || {},
			tweets: tweets || [],
			accounts: accounts || []
		}, { headers: { 'cache-control': 'no-cache' } });
	} catch (error) {
		logger.error({ error }, 'Failed to load batched dashboard data');
		return json(
			{
				apps: [],
				analytics: {},
				tweets: [],
				accounts: [],
				error: 'Failed to load dashboard data'
			},
			{ status: 500 }
		);
	}
};

// Extract analytics computation to reuse logic
async function computeAnalytics(db: any, userId: string) {
	const tweets = await db.getAllTweets(userId);
	const accounts = await (db as any).getAllUserAccounts();

	const totalTweets = tweets.length;
	const postedTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'POSTED').length;
	const scheduledTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'SCHEDULED').length;
	const failedTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'FAILED').length;
	const draftTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'DRAFT').length;
	const successRate = totalTweets > 0 ? Math.round((postedTweets / totalTweets) * 100) : 0;

	const recentActivity = tweets
		.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, 10)
		.map((tweet: any) => ({
			message: `Tweet ${tweet.status.toLowerCase()}: ${tweet.content.substring(0, 50)}...`,
			time: new Date(tweet.createdAt).toLocaleString()
		}));

	const errors = tweets
		.filter((t: any) => t.status === 'FAILED')
		.slice(0, 5)
		.map((tweet: any) => ({
			message: tweet.error || 'Unknown error',
			time: new Date(tweet.createdAt).toLocaleString()
		}));

	return {
		totalTweets,
		postedTweets,
		scheduledTweets,
		failedTweets,
		draftTweets,
		successRate,
		totalAccounts: accounts.length,
		recentActivity,
		errors
	};
}
