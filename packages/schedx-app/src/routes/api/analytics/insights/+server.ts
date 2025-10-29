/**
 * Insights API
 * 
 * GET  /api/analytics/insights - Get active insights
 * POST /api/analytics/insights - Dismiss an insight
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import type { Insight } from '$lib/types/analytics';

/**
 * GET /api/analytics/insights
 * 
 * Returns active (non-dismissed, non-expired) insights for the user.
 */
export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.data.user.id;
		
		const results = (db as any)['db'].query(
			`SELECT * FROM insights 
			 WHERE user_id = ? AND dismissed = 0 AND expires_at > ?
			 ORDER BY priority DESC, generated_at DESC`,
			[userId, Date.now()]
		);
		
		const insights: Insight[] = results.map((row: any) => ({
			id: row.id,
			userId: row.user_id,
			insightType: row.insight_type,
			title: row.title,
			message: row.message,
			priority: row.priority,
			data: row.data ? JSON.parse(row.data) : null,
			generatedAt: new Date(row.generated_at),
			expiresAt: new Date(row.expires_at),
			dismissed: row.dismissed === 1
		}));

		return json({ insights });

	} catch (error) {
		logger.error({ error }, 'Failed to fetch insights');
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to fetch insights' },
			{ status: 500 }
		);
	}
};

/**
 * POST /api/analytics/insights
 * 
 * Dismisses an insight.
 * 
 * Body: { insightId: string }
 */
export const POST: RequestHandler = async ({ cookies, request }) => {
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.data.user.id;
		const body = await request.json();
		const { insightId } = body;

		if (!insightId) {
			return json({ error: 'insightId is required' }, { status: 400 });
		}

		// Verify insight belongs to user
		const insight = (db as any)['db'].queryOne(
			'SELECT user_id FROM insights WHERE id = ?',
			[insightId]
		);

		if (!insight) {
			return json({ error: 'Insight not found' }, { status: 404 });
		}

		if (insight.user_id !== userId) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		// Dismiss the insight
		(db as any)['db'].execute(
			'UPDATE insights SET dismissed = 1 WHERE id = ?',
			[insightId]
		);

		logger.info({ userId, insightId }, 'Insight dismissed');

		return json({ success: true, message: 'Insight dismissed' });

	} catch (error) {
		logger.error({ error }, 'Failed to dismiss insight');
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to dismiss insight' },
			{ status: 500 }
		);
	}
};
