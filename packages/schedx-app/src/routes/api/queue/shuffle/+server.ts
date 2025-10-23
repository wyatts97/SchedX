import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

// POST: Shuffle queue tweets
export const POST: RequestHandler = async ({ request, cookies }) => {
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

		// Get optional account filter from request body
		const body = await request.json().catch(() => ({}));
		const twitterAccountId = body.twitterAccountId;

		log.info('Shuffling queue', { userId, twitterAccountId });

		await (db as any).shuffleQueue(userId, twitterAccountId);

		log.info('Queue shuffled successfully', { userId, twitterAccountId });

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Queue shuffled successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error shuffling queue', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to shuffle queue',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
