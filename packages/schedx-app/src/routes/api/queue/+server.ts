import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';

// GET: Fetch queued tweets
export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const userId = user.id;

		const tweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);

		log.info('Fetched queued tweets', { count: tweets.length });

		return new Response(
			JSON.stringify({
				tweets,
				success: true
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error fetching queued tweets', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch queued tweets',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
