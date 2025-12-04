import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RettiwtService } from '$lib/server/rettiwtService';
import logger from '$lib/server/logger';

/**
 * GET /api/twitter/analytics/:username
 * Fetch analytics for a Twitter username
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	const { username } = params;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	if (!username) {
		throw error(400, 'Username is required');
	}

	try {
		logger.debug({ username, userId: user.id }, 'Fetching Twitter analytics');

		const analytics = await RettiwtService.getUserAnalytics(username, user.id);

		return json(analytics);
	} catch (err: any) {
		logger.error({ error: err, username, userId: user.id }, 'Failed to fetch Twitter analytics');
		
		// Return more specific error messages
		if (err.message?.includes('not found')) {
			throw error(404, 'Twitter user not found');
		}
		
		throw error(500, 'Failed to fetch analytics');
	}
};
