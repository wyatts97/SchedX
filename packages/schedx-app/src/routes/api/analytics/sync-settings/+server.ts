import { json, type RequestEvent } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * GET /api/analytics/sync-settings
 * Get the user's sync settings (time and last error)
 */
export const GET = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = getDbInstance();
		const settings = (db as any)['db'].queryOne(
			'SELECT sync_time, last_sync_error, last_sync_at FROM user_sync_settings WHERE user_id = ?',
			[userId]
		);

		return json({
			syncTime: settings?.sync_time || '03:00',
			lastError: settings?.last_sync_error || null,
			lastSyncAt: settings?.last_sync_at || null
		});
	} catch (error) {
		logger.error('Failed to get sync settings', { error });
		return json({ error: 'Failed to get sync settings' }, { status: 500 });
	}
};

/**
 * POST /api/analytics/sync-settings
 * Save the user's sync time preference
 */
export const POST = async (event: RequestEvent) => {
	try {
		const userId = event.locals.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { syncTime } = await event.request.json();

		if (!syncTime || !/^\d{2}:\d{2}$/.test(syncTime)) {
			return json({ error: 'Invalid sync time format' }, { status: 400 });
		}

		const db = getDbInstance();
		
		// Check if settings exist
		const existing = (db as any)['db'].queryOne(
			'SELECT id FROM user_sync_settings WHERE user_id = ?',
			[userId]
		);

		if (existing) {
			// Update existing
			(db as any)['db'].execute(
				'UPDATE user_sync_settings SET sync_time = ?, updated_at = ? WHERE user_id = ?',
				[syncTime, Date.now(), userId]
			);
		} else {
			// Insert new
			(db as any)['db'].execute(
				'INSERT INTO user_sync_settings (id, user_id, sync_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
				[crypto.randomUUID(), userId, syncTime, Date.now(), Date.now()]
			);
		}

		logger.info('Sync time updated', { userId, syncTime });

		return json({ success: true });
	} catch (error) {
		logger.error('Failed to save sync settings', { error });
		return json({ error: 'Failed to save sync settings' }, { status: 500 });
	}
};
