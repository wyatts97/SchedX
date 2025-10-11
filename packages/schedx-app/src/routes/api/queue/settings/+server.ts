import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

// GET: Fetch queue settings
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

		const settings = await db.getQueueSettings(userId);

		return new Response(
			JSON.stringify({
				settings: settings || {
					enabled: true,
					postingTimes: ['09:00', '13:00', '17:00'],
					timezone: 'America/New_York',
					minInterval: 60,
					maxPostsPerDay: 10,
					skipWeekends: false
				},
				success: true
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error fetching queue settings', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch queue settings',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

// POST: Save queue settings
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
		const settings = await request.json();

		// Add userId to settings
		settings.userId = userId;

		const settingsId = await db.saveQueueSettings(settings);

		log.info('Queue settings saved', { settingsId, userId });

		return new Response(
			JSON.stringify({
				success: true,
				id: settingsId,
				message: 'Queue settings saved successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error saving queue settings', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to save queue settings',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
