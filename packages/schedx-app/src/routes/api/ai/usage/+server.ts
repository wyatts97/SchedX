import type { RequestHandler } from '@sveltejs/kit';
import { AIService } from '$lib/server/aiService';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Get user from session
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Get timeframe from query params (default to 'month')
		const timeframe = (url.searchParams.get('timeframe') || 'month') as 'day' | 'week' | 'month';

		// Get usage stats
		const aiService = AIService.getInstance();
		const stats = await aiService.getUsageStats(session.data.user.id, timeframe);

		return new Response(
			JSON.stringify({ success: true, stats }),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log.error(`Failed to get AI usage stats: ${errorMsg}`);

		return new Response(
			JSON.stringify({ error: 'Failed to fetch usage statistics' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
