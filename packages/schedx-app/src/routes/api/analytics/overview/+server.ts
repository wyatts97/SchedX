/**
 * Analytics Overview API
 * 
 * GET /api/analytics/overview
 * 
 * Returns comprehensive analytics data for the dashboard overview tab.
 * Includes activity summary, engagement metrics, content mix, trends, and insights.
 * 
 * Query Parameters:
 * - dateRange: '7d' | '30d' | '90d' (default: '7d')
 * - accountId: string (optional, filters by specific account)
 * 
 * Response: OverviewAnalytics
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import {
	calculateActivitySummary,
	calculateEngagementSnapshot,
	calculateContentMix,
	calculateTrends,
	getSystemStatus
} from '$lib/server/analytics/aggregators';
import type { DateRange, OverviewAnalytics, Insight } from '$lib/types/analytics';

// Simple in-memory cache (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/analytics/overview
 * 
 * Returns aggregated analytics for the overview dashboard.
 */
export const GET: RequestHandler = async ({ cookies, url }) => {
	// Verify admin session
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
		
		// Get query parameters
		const dateRange = (url.searchParams.get('dateRange') || '7d') as DateRange;
		const accountId = url.searchParams.get('accountId');
		
		// Check cache
		const cacheKey = `overview:${userId}:${dateRange}:${accountId || 'all'}`;
		const cached = cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
			logger.debug({ userId, cacheKey }, 'Returning cached overview data');
			return json(cached.data);
		}

		logger.info({ userId, dateRange, accountId }, 'Fetching overview analytics');

		// Fetch all analytics data in parallel
		const [
			activitySummary,
			engagementSnapshot,
			contentMix,
			trends,
			systemStatus,
			insights
		] = await Promise.all([
			calculateActivitySummary(userId),
			calculateEngagementSnapshot(userId, dateRange),
			calculateContentMix(userId, dateRange),
			calculateTrends(userId, dateRange),
			getSystemStatus(userId),
			getActiveInsights(userId)
		]);

		const response: OverviewAnalytics = {
			activitySummary,
			engagementSnapshot,
			contentMix,
			trends,
			insights,
			systemStatus
		};

		// Cache the response
		cache.set(cacheKey, {
			data: response,
			timestamp: Date.now()
		});

		// Clean old cache entries (simple cleanup)
		if (cache.size > 100) {
			const now = Date.now();
			for (const [key, value] of cache.entries()) {
				if (now - value.timestamp > CACHE_DURATION) {
					cache.delete(key);
				}
			}
		}

		logger.info({ userId, dateRange }, 'Overview analytics fetched successfully');
		return json(response);

	} catch (error) {
		logger.error({ error }, 'Failed to fetch overview analytics');
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to fetch analytics'
			},
			{ status: 500 }
		);
	}
};

/**
 * Get active (non-dismissed, non-expired) insights for a user
 */
async function getActiveInsights(userId: string): Promise<Insight[]> {
	const db = getDbInstance();
	
	const results = (db as any)['db'].query(
		`SELECT * FROM insights 
		 WHERE user_id = ? AND dismissed = 0 AND expires_at > ?
		 ORDER BY priority DESC, generated_at DESC
		 LIMIT 10`,
		[userId, Date.now()]
	);
	
	return results.map((row: any) => ({
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
}
