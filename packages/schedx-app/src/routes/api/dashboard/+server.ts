import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import { getCachedAnalytics } from '$lib/server/services/analyticsCache';

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

		// OPTIMIZATION: Use cached analytics where possible
		const [appsResult, tweetsResult, accountsResult] = await Promise.all([
			db.listTwitterApps().catch(() => ([])),
			db.getAllTweets(userId).catch(() => ([])),
			(db as any).getAllUserAccounts().catch(() => ([]))
		]);

		// Transform results to match expected format
		const apps = Array.isArray(appsResult) ? appsResult : [];
		const tweets = Array.isArray(tweetsResult) ? tweetsResult : [];
		const accounts = Array.isArray(accountsResult) ? accountsResult : [];
		
		// OPTIMIZATION: Use cached analytics (1 minute TTL)
		const analytics = await getCachedAnalytics(
			'dashboard',
			userId,
			async () => computeAnalyticsFromData(tweets, accounts)
		);

		logger.debug(`Dashboard data loaded: apps=${apps.length}, tweets=${tweets.length}, accounts=${accounts.length}`);

		return json({
			apps: apps || [],
			analytics: analytics || {},
			tweets: tweets || [],
			accounts: accounts || []
		}, { 
			headers: { 
				// OPTIMIZATION: Allow short client-side caching (30s) for dashboard data
				'cache-control': 'private, max-age=30, stale-while-revalidate=60' 
			} 
		});
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

// OPTIMIZATION: Compute analytics from already-fetched data (no duplicate DB calls)
function computeAnalyticsFromData(tweets: any[], accounts: any[]) {
	const totalTweets = tweets.length;
	const postedTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'POSTED').length;
	const scheduledTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'SCHEDULED').length;
	const failedTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'FAILED').length;
	const draftTweets = tweets.filter((t: any) => t.status?.toUpperCase() === 'DRAFT').length;
	const successRate = totalTweets > 0 ? Math.round((postedTweets / totalTweets) * 100) : 0;

	const recentActivity = [...tweets]
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
