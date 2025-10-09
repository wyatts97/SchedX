import type { PageServerLoad } from './$types';
import logger from '$lib/server/logger';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const [appsRes, analyticsRes, tweetsRes, accountsRes] = await Promise.all([
			fetch('/api/twitter_apps'),
			fetch('/api/admin/analytics'),
			fetch('/api/admin/tweets'),
			fetch('/api/accounts')
		]);

		const apps = await appsRes.json();
		const analytics = await analyticsRes.json();
		const tweets = await tweetsRes.json();
		const accounts = await accountsRes.json();

		logger.info(`Page server loaded data: apps=${appsRes.status}, analytics=${analyticsRes.status}, tweets=${tweetsRes.status}, accounts=${accountsRes.status}`);

		return {
			apps: apps.apps || [],
			analytics: analytics.analytics || {},
			tweets: tweets.tweets || [],
			accounts: accounts.accounts || []
		};
	} catch (error) {
		logger.error('Failed to load dashboard data');
		return {
			apps: [],
			analytics: {},
			tweets: [],
			accounts: [],
			error: 'Failed to load dashboard data'
		};
	}
};
