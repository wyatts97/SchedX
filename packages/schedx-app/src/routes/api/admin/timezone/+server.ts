import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';

/**
 * GET /api/admin/timezone - Get user's timezone setting
 */
export const GET: RequestHandler = async ({ locals, cookies }) => {
	// Check for admin session first
	const adminSession = cookies.get('admin_session');
	let userId = null;

	if (adminSession && adminSession.trim() !== '') {
		try {
			const db = getDbInstance();
			const session = await db.getSession(adminSession);
			if (session && session.data?.user?.id) {
				userId = session.data.user.id;
			}
		} catch (error) {
			console.error('Error validating admin session:', error);
		}
	}

	// If not admin, check OAuth session
	if (!userId) {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		userId = session.user.id;
	}

	try {
		const db = getDbInstance();
		const timezone = await db.getUserTimezone(userId);
		
		return json({ 
			timezone,
			detected: false // Will be true when auto-detected on client
		});
	} catch (error) {
		console.error('Failed to get timezone:', error);
		return json({ error: 'Failed to get timezone' }, { status: 500 });
	}
};

/**
 * POST /api/admin/timezone - Update user's timezone setting
 */
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	// Check for admin session first
	const adminSession = cookies.get('admin_session');
	let userId = null;

	if (adminSession && adminSession.trim() !== '') {
		try {
			const db = getDbInstance();
			const session = await db.getSession(adminSession);
			if (session && session.data?.user?.id) {
				userId = session.data.user.id;
			}
		} catch (error) {
			console.error('Error validating admin session:', error);
		}
	}

	// If not admin, check OAuth session
	if (!userId) {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		userId = session.user.id;
	}

	try {
		const { timezone } = await request.json();
		
		if (!timezone || typeof timezone !== 'string') {
			return json({ error: 'Timezone is required' }, { status: 400 });
		}

		// Validate timezone is a valid IANA timezone
		try {
			Intl.DateTimeFormat(undefined, { timeZone: timezone });
		} catch {
			return json({ error: 'Invalid timezone' }, { status: 400 });
		}

		const db = getDbInstance();
		await db.updateUserTimezone(userId, timezone);
		
		return json({ 
			success: true, 
			timezone,
			message: 'Timezone updated successfully'
		});
	} catch (error) {
		console.error('Failed to update timezone:', error);
		return json({ error: 'Failed to update timezone' }, { status: 500 });
	}
};
