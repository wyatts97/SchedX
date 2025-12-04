import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RettiwtService } from '$lib/server/rettiwtService';
import logger from '$lib/server/logger';

/**
 * GET /api/twitter/tweet/:tweetId
 * Fetch details for a specific tweet
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	const { tweetId } = params;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	if (!tweetId) {
		throw error(400, 'Tweet ID is required');
	}

	try {
		logger.debug({ tweetId, userId: user.id }, 'Fetching tweet details');

		const tweetDetails = await RettiwtService.getTweetDetails(tweetId, user.id);

		return json(tweetDetails);
	} catch (err: any) {
		logger.error({ error: err, tweetId, userId: user.id }, 'Failed to fetch tweet details');
		
		// Return more specific error messages
		if (err.message?.includes('not found')) {
			throw error(404, 'Tweet not found');
		}
		
		throw error(500, 'Failed to fetch tweet details');
	}
};
