import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';

// GET: Get email notification preferences
export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session) {
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		const userId = session.data.user.id;

		// Get email preferences
		const preferences = await db.getEmailNotificationPreferences(userId);

		return json({
			preferences: preferences || {
				enabled: false,
				email: null,
				onSuccess: true,
				onFailure: true
			}
		});
	} catch (error) {
		console.error('Error getting email preferences:', error);
		return json({ error: 'Failed to get email preferences' }, { status: 500 });
	}
};

// POST: Update email notification preferences
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session) {
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		const userId = session.data.user.id;
		const body = await request.json();

		// Validate email if provided
		if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		// Update preferences
		await db.updateEmailNotificationPreferences(userId, {
			enabled: body.enabled,
			email: body.email,
			onSuccess: body.onSuccess,
			onFailure: body.onFailure
		});

		return json({ success: true, message: 'Email preferences updated successfully' });
	} catch (error) {
		console.error('Error updating email preferences:', error);
		return json({ error: 'Failed to update email preferences' }, { status: 500 });
	}
};
