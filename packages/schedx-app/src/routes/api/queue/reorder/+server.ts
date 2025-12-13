import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * POST /api/queue/reorder
 * Reorder queued tweets based on provided order
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAuthenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { tweetIds } = await request.json();

		if (!Array.isArray(tweetIds) || tweetIds.length === 0) {
			return json({ error: 'Invalid tweet IDs' }, { status: 400 });
		}

		const db = getDbInstance();

		// Update queue_position for each tweet based on array order
		for (let i = 0; i < tweetIds.length; i++) {
			const tweetId = tweetIds[i];
			await db.updateTweet(tweetId, { queuePosition: i + 1 });
		}

		logger.info(`Queue reordered: ${tweetIds.length} tweets`);

		return json({ success: true, message: 'Queue order updated' });
	} catch (error) {
		logger.error(`Failed to reorder queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return json({ error: 'Failed to reorder queue' }, { status: 500 });
	}
};
