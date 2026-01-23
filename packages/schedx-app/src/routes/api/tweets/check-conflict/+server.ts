import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

/**
 * Check for scheduling conflicts at a specific time
 * GET /api/tweets/check-conflict?date=ISO_STRING&accountId=ACCOUNT_ID&excludeTweetId=TWEET_ID
 */
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
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
			log.error('Error validating admin session', { error });
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

	const dateStr = url.searchParams.get('date');
	const accountId = url.searchParams.get('accountId');
	const excludeTweetId = url.searchParams.get('excludeTweetId') || undefined;

	if (!dateStr) {
		return json({ error: 'Date parameter is required' }, { status: 400 });
	}

	if (!accountId) {
		return json({ error: 'Account ID parameter is required' }, { status: 400 });
	}

	try {
		const scheduledDate = new Date(dateStr);
		
		if (isNaN(scheduledDate.getTime())) {
			return json({ error: 'Invalid date format' }, { status: 400 });
		}

		const db = getDbInstance();
		const result = await (db as any).checkScheduleConflict(
			userId,
			scheduledDate,
			accountId,
			excludeTweetId
		);

		return json({
			hasConflict: result.hasConflict,
			conflictingTweet: result.conflictingTweet ? {
				id: result.conflictingTweet.id,
				content: result.conflictingTweet.content.substring(0, 100) + (result.conflictingTweet.content.length > 100 ? '...' : ''),
				scheduledDate: result.conflictingTweet.scheduledDate.toISOString()
			} : null
		});
	} catch (error) {
		log.error('Error checking schedule conflict', { error, userId, dateStr, accountId });
		return json({ error: 'Failed to check for conflicts' }, { status: 500 });
	}
};
