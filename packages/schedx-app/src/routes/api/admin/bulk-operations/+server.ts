import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();

		// Verify session exists and is valid
		const session = await db.getSession(adminSession);
		if (!session) {
			return json({ error: 'Unauthorized - Session expired' }, { status: 401 });
		}

		// Verify admin user exists and session belongs to admin
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return json({ error: 'Unauthorized - Admin user not found' }, { status: 401 });
		}

		// Validate that the session belongs to the admin user
		if (session.data.user.username !== 'admin') {
			return json({ error: 'Unauthorized - Invalid session' }, { status: 401 });
		}

		const { action, tweetIds } = await request.json();

		if (!action || !tweetIds || !Array.isArray(tweetIds) || tweetIds.length === 0) {
			return json({ error: 'Invalid request parameters' }, { status: 400 });
		}

		let result;
		switch (action) {
			case 'delete':
				result = await (db as any).deleteTweets(tweetIds);
				break;
			case 'reschedule':
				// For reschedule, we'd need additional parameters like new date
				// For now, just mark as rescheduled
				result = await (db as any).updateTweetsStatus(tweetIds, 'SCHEDULED');
				break;
			case 'duplicate':
				result = await (db as any).duplicateTweets(tweetIds);
				break;
			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}

		return json({
			success: true,
			message: `Bulk ${action} completed successfully`,
			affectedCount: result?.modifiedCount || tweetIds.length
		});
	} catch (error) {
		logger.error('Error executing bulk operation');
		return json({ error: 'Failed to execute bulk operation' }, { status: 500 });
	}
};
