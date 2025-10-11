import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import logger from '$lib/server/logger';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	// Check authentication first - redirect to login if not authenticated
	if (!locals.isAuthenticated || !locals.isAdmin) {
		logger.info('Unauthenticated access to dashboard, redirecting to login');
		throw redirect(302, '/login');
	}

	try {
		// Use single batched API call for better performance
		const dashboardRes = await fetch('/api/dashboard');

		if (!dashboardRes.ok) {
			throw new Error('Dashboard API failed');
		}

		const data = await dashboardRes.json();
		logger.info(`Dashboard data loaded: ${dashboardRes.status}`);

		return {
			apps: data.apps || [],
			analytics: data.analytics || {},
			tweets: data.tweets || [],
			accounts: data.accounts || []
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
