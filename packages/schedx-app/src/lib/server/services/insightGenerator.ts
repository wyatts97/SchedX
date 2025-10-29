/**
 * Insight Generator Service
 * 
 * Generates actionable insights from analytics data.
 * Runs daily to provide users with smart recommendations.
 */

import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import { nanoid } from 'nanoid';
import type { Insight, InsightType, InsightPriority } from '$lib/types/analytics';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ============================================================================
// Best Posting Time Insight
// ============================================================================

/**
 * Analyzes posting times to find when engagement is highest.
 * 
 * Looks at content_analytics to find hour/day combinations with best engagement.
 */
export async function generateBestTimeInsight(userId: string): Promise<Insight | null> {
	try {
		const db = getDbInstance();
		
		// Get all tweets from user's accounts with content analytics
		const query = `
			SELECT ca.post_hour, ca.post_day, AVG(ca.engagement_score) as avg_engagement, COUNT(*) as sample_size
			FROM content_analytics ca
			JOIN tweets t ON ca.tweet_id = t.id
			WHERE t.userId = ? AND t.status = 'POSTED'
			GROUP BY ca.post_hour, ca.post_day
			HAVING sample_size >= 3
			ORDER BY avg_engagement DESC
			LIMIT 1
		`;
		
		const result = (db as any)['db'].queryOne(query, [userId]);
		
		if (!result || result.sample_size < 3) {
			return null; // Not enough data
		}
		
		const dayName = DAY_NAMES[result.post_day];
		const hour = result.post_hour;
		const timeStr = formatHour(hour);
		
		// Calculate priority based on engagement difference
		const priority: InsightPriority = result.avg_engagement > 50 ? 2 : result.avg_engagement > 20 ? 1 : 0;
		
		const insight: Insight = {
			id: nanoid(),
			userId,
			insightType: 'best_time',
			title: '⏰ Best Posting Time',
			message: `Your best posting time is ${dayName} at ${timeStr} with an average of ${Math.round(result.avg_engagement)} engagements.`,
			priority,
			data: {
				day: result.post_day,
				dayName,
				hour,
				avgEngagement: result.avg_engagement,
				sampleSize: result.sample_size
			},
			generatedAt: new Date(),
			expiresAt: getExpirationDate(7), // Expires in 7 days
			dismissed: false
		};
		
		return insight;
	} catch (error) {
		logger.error({ error, userId }, 'Failed to generate best time insight');
		return null;
	}
}

// ============================================================================
// Content Type Performance Insight
// ============================================================================

/**
 * Compares engagement across different content types.
 * 
 * Identifies which content type (image, video, text) performs best.
 */
export async function generateContentTypeInsight(userId: string): Promise<Insight | null> {
	try {
		const db = getDbInstance();
		
		// Get average engagement by content type
		const query = `
			SELECT 
				CASE 
					WHEN ca.has_video = 1 THEN 'video'
					WHEN ca.has_image = 1 THEN 'image'
					WHEN ca.has_gif = 1 THEN 'gif'
					ELSE 'text'
				END as content_type,
				AVG(ca.engagement_score) as avg_engagement,
				COUNT(*) as sample_size
			FROM content_analytics ca
			JOIN tweets t ON ca.tweet_id = t.id
			WHERE t.userId = ? AND t.status = 'POSTED'
			GROUP BY content_type
			HAVING sample_size >= 5
			ORDER BY avg_engagement DESC
		`;
		
		const results = (db as any)['db'].query(query, [userId]);
		
		if (!results || results.length < 2) {
			return null; // Need at least 2 content types to compare
		}
		
		const best = results[0];
		const baseline = results[results.length - 1];
		const multiplier = (best.avg_engagement / baseline.avg_engagement).toFixed(1);
		
		// Only create insight if difference is significant (>1.5x)
		if (parseFloat(multiplier) < 1.5) {
			return null;
		}
		
		const priority: InsightPriority = parseFloat(multiplier) > 3 ? 2 : parseFloat(multiplier) > 2 ? 1 : 0;
		
		const insight: Insight = {
			id: nanoid(),
			userId,
			insightType: 'content_type',
			title: '📊 Content Performance',
			message: `Posts with ${best.content_type} get ${multiplier}× more engagement than ${baseline.content_type}-only posts.`,
			priority,
			data: {
				bestType: best.content_type,
				engagementMultiplier: parseFloat(multiplier),
				sampleSize: best.sample_size
			},
			generatedAt: new Date(),
			expiresAt: getExpirationDate(7),
			dismissed: false
		};
		
		return insight;
	} catch (error) {
		logger.error({ error, userId }, 'Failed to generate content type insight');
		return null;
	}
}

// ============================================================================
// Inactive Account Insight
// ============================================================================

/**
 * Identifies accounts that haven't posted in a while.
 * 
 * Alerts user to potentially neglected accounts.
 */
export async function generateInactiveAccountInsight(userId: string): Promise<Insight[]> {
	try {
		const db = getDbInstance();
		
		// Find accounts with no posts in last 5 days
		const query = `
			SELECT 
				a.id,
				a.username,
				MAX(t.createdAt) as last_post_time,
				CAST((julianday('now') - julianday(MAX(t.createdAt) / 1000, 'unixepoch')) AS INTEGER) as days_inactive
			FROM accounts a
			LEFT JOIN tweets t ON a.providerAccountId = t.twitterAccountId AND t.status = 'POSTED'
			WHERE a.userId = ?
			GROUP BY a.id, a.username
			HAVING days_inactive >= 5 OR last_post_time IS NULL
		`;
		
		const results = (db as any)['db'].query(query, [userId]);
		
		if (!results || results.length === 0) {
			return [];
		}
		
		const insights: Insight[] = results.map((account: any) => ({
			id: nanoid(),
			userId,
			insightType: 'inactive_account' as InsightType,
			title: '⚠️ Inactive Account',
			message: account.last_post_time
				? `Account @${account.username} hasn't posted in ${account.days_inactive} days.`
				: `Account @${account.username} has never posted.`,
			priority: (account.days_inactive >= 14 ? 2 : account.days_inactive >= 7 ? 1 : 0) as InsightPriority,
			data: {
				accountId: account.id,
				username: account.username,
				daysSinceLastPost: account.days_inactive,
				lastPostDate: account.last_post_time ? new Date(account.last_post_time) : null
			},
			generatedAt: new Date(),
			expiresAt: getExpirationDate(3), // Expires in 3 days
			dismissed: false
		}));
		
		return insights;
	} catch (error) {
		logger.error({ error, userId }, 'Failed to generate inactive account insights');
		return [];
	}
}

// ============================================================================
// Top Hashtag Insight
// ============================================================================

/**
 * Identifies hashtags that drive the most engagement.
 */
export async function generateTopHashtagInsight(userId: string): Promise<Insight | null> {
	try {
		const db = getDbInstance();
		
		// Get all hashtags with their engagement
		const query = `
			SELECT ca.hashtags, ca.engagement_score
			FROM content_analytics ca
			JOIN tweets t ON ca.tweet_id = t.id
			WHERE t.userId = ? AND t.status = 'POSTED' AND ca.hashtag_count > 0
		`;
		
		const results = (db as any)['db'].query(query, [userId]);
		
		if (!results || results.length === 0) {
			return null;
		}
		
		// Aggregate hashtag performance
		const hashtagStats: Record<string, { total: number; count: number }> = {};
		
		for (const row of results) {
			const hashtags = JSON.parse(row.hashtags || '[]');
			for (const tag of hashtags) {
				if (!hashtagStats[tag]) {
					hashtagStats[tag] = { total: 0, count: 0 };
				}
				hashtagStats[tag].total += row.engagement_score;
				hashtagStats[tag].count += 1;
			}
		}
		
		// Find top performing hashtag (min 3 uses)
		let topHashtag: string | null = null;
		let topAvg = 0;
		let topCount = 0;
		
		for (const [tag, stats] of Object.entries(hashtagStats)) {
			if (stats.count >= 3) {
				const avg = stats.total / stats.count;
				if (avg > topAvg) {
					topAvg = avg;
					topHashtag = tag;
					topCount = stats.count;
				}
			}
		}
		
		if (!topHashtag) {
			return null;
		}
		
		const priority: InsightPriority = topAvg > 50 ? 2 : topAvg > 20 ? 1 : 0;
		
		const insight: Insight = {
			id: nanoid(),
			userId,
			insightType: 'top_hashtag',
			title: '🏷️ Top Hashtag',
			message: `#${topHashtag} drives the most engagement with an average of ${Math.round(topAvg)} interactions (used ${topCount} times).`,
			priority,
			data: {
				hashtag: topHashtag,
				useCount: topCount,
				avgEngagement: topAvg
			},
			generatedAt: new Date(),
			expiresAt: getExpirationDate(7),
			dismissed: false
		};
		
		return insight;
	} catch (error) {
		logger.error({ error, userId }, 'Failed to generate top hashtag insight');
		return null;
	}
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generates all insights for a user and stores them in the database.
 * 
 * This should be called daily by the cron job.
 */
export async function generateAllInsights(userId: string): Promise<{
	success: boolean;
	insightsGenerated: number;
	errors: string[];
}> {
	const db = getDbInstance();
	const errors: string[] = [];
	let insightsGenerated = 0;
	
	try {
		// Clear expired insights
		(db as any)['db'].execute(
			'DELETE FROM insights WHERE userId = ? AND expires_at < ?',
			[userId, Date.now()]
		);
		
		// Generate each type of insight
		const generators = [
			generateBestTimeInsight,
			generateContentTypeInsight,
			generateTopHashtagInsight
		];
		
		for (const generator of generators) {
			try {
				const insight = await generator(userId);
				if (insight) {
					await storeInsight(insight);
					insightsGenerated++;
				}
			} catch (error) {
				errors.push(`${generator.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
		
		// Generate inactive account insights (can return multiple)
		try {
			const inactiveInsights = await generateInactiveAccountInsight(userId);
			for (const insight of inactiveInsights) {
				await storeInsight(insight);
				insightsGenerated++;
			}
		} catch (error) {
			errors.push(`generateInactiveAccountInsight: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
		
		logger.info({ userId, insightsGenerated, errors: errors.length }, 'Insights generated');
		
		return {
			success: true,
			insightsGenerated,
			errors
		};
	} catch (error) {
		logger.error({ error, userId }, 'Failed to generate insights');
		return {
			success: false,
			insightsGenerated,
			errors: [error instanceof Error ? error.message : 'Unknown error']
		};
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Store insight in database
 */
async function storeInsight(insight: Insight): Promise<void> {
	const db = getDbInstance();
	
	// Check if similar insight already exists (not dismissed, not expired)
	const existing = (db as any)['db'].queryOne(
		`SELECT id FROM insights 
		 WHERE userId = ? AND insight_type = ? AND dismissed = 0 AND expires_at > ?`,
		[insight.userId, insight.insightType, Date.now()]
	);
	
	if (existing) {
		// Update existing insight
		(db as any)['db'].execute(
			`UPDATE insights SET
				title = ?, message = ?, priority = ?, data = ?,
				generated_at = ?, expires_at = ?
			 WHERE id = ?`,
			[
				insight.title,
				insight.message,
				insight.priority,
				JSON.stringify(insight.data),
				insight.generatedAt.getTime(),
				insight.expiresAt.getTime(),
				existing.id
			]
		);
	} else {
		// Insert new insight
		(db as any)['db'].execute(
			`INSERT INTO insights (
				id, user_id, insight_type, title, message, priority,
				data, generated_at, expires_at, dismissed
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				insight.id,
				insight.userId,
				insight.insightType,
				insight.title,
				insight.message,
				insight.priority,
				JSON.stringify(insight.data),
				insight.generatedAt.getTime(),
				insight.expiresAt.getTime(),
				insight.dismissed ? 1 : 0
			]
		);
	}
}

/**
 * Format hour as 12-hour time
 */
function formatHour(hour: number): string {
	if (hour === 0) return '12 AM';
	if (hour === 12) return '12 PM';
	if (hour < 12) return `${hour} AM`;
	return `${hour - 12} PM`;
}

/**
 * Get expiration date (days from now)
 */
function getExpirationDate(days: number): Date {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return date;
}
