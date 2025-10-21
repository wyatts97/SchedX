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

		// Get Resend settings
		const resendSettings = await (db as any).getResendSettings(userId);

		return json({
			preferences: preferences || {
				enabled: false,
				email: null,
				onSuccess: true,
				onFailure: true
			},
			resendSettings: resendSettings || {
				enabled: false,
				apiKey: '',
				fromEmail: 'noreply@schedx.app',
				fromName: 'SchedX'
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

		// Validate Resend API key format if provided
		if (body.resendApiKey && !body.resendApiKey.startsWith('re_')) {
			return json({ error: 'Invalid Resend API key format. Keys should start with "re_"' }, { status: 400 });
		}

		// Update email notification preferences
		await db.updateEmailNotificationPreferences(userId, {
			enabled: body.enabled,
			email: body.email,
			onSuccess: body.onSuccess,
			onFailure: body.onFailure
		});

		// Update Resend settings if provided
		if (body.resendApiKey || body.resendFromEmail || body.resendFromName || body.resendEnabled !== undefined) {
			const existing = await (db as any).getResendSettings(userId);
			
			await (db as any).saveResendSettings({
				userId,
				apiKey: body.resendApiKey || existing?.apiKey || '',
				fromEmail: body.resendFromEmail || existing?.fromEmail,
				fromName: body.resendFromName || existing?.fromName,
				enabled: body.resendEnabled !== undefined ? body.resendEnabled : existing?.enabled
			});
		}

		return json({ success: true, message: 'Email settings updated successfully' });
	} catch (error) {
		console.error('Error updating email preferences:', error);
		return json({ error: 'Failed to update email preferences' }, { status: 500 });
	}
};
