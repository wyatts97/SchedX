import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { QueueProcessorService } from '@schedx/shared-lib/backend';
import { log } from '$lib/server/logger';

// POST: Process the queue and schedule tweets
export const POST: RequestHandler = async ({ cookies }) => {
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

		log.info('Processing queue manually', { userId });

		const result = await QueueProcessorService.processQueue(db, userId);

		log.info('Queue processed', {
			scheduled: result.scheduled,
			errors: result.errors.length
		});

		return new Response(
			JSON.stringify({
				success: true,
				scheduled: result.scheduled,
				errors: result.errors,
				message: `Successfully scheduled ${result.scheduled} tweets`
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error processing queue', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to process queue',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
