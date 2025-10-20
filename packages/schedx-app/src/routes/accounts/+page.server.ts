import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import logger from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication - redirect to login if not authenticated
	if (!locals.isAuthenticated || !locals.isAdmin) {
		logger.info('Unauthenticated access to accounts page, redirecting to login');
		throw redirect(302, '/login');
	}

	// Return authentication status
	return {
		isAuthenticated: locals.isAuthenticated,
		isAdmin: locals.isAdmin,
		user: locals.user
	};
};
