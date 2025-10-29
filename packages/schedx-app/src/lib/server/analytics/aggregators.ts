/**
 * Analytics Aggregation Functions
 * 
 * Aggregates raw analytics data into dashboard-ready formats.
 * All functions use SQLite queries for performance.
 */

import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import type {
	ActivitySummary,
	EngagementSnapshotData,
	ContentMixData,
	TrendData,
	PostTypeDistribution,
	HashtagFrequency,
	PostingTimeHeatmap,
	TopPost,
	TopAccount,
	SystemStatus,
	AccountStatus,
	QueueHealth,
	DateRange
} from '$lib/types/analytics';

// ============================================================================
// Activity Summary
// ============================================================================

/**
 * Calculates activity summary metrics for the dashboard.
 */
export async function calculateActivitySummary(userId: string): Promise<ActivitySummary> {
	const db = getDbInstance();
	
	try {
		// Get connected accounts count
		const accountsResult = (db as any)['db'].queryOne(
			'SELECT COUNT(*) as count FROM accounts WHERE userId = ?',
			[userId]
		);
		
		// Get tweet counts by status
		const tweetsResult = (db as any)['db'].queryOne(
			`SELECT 
				COUNT(CASE WHEN UPPER(status) = 'POSTED' THEN 1 END) as published,
				COUNT(CASE WHEN UPPER(status) = 'SCHEDULED' THEN 1 END) as scheduled,
				COUNT(CASE WHEN UPPER(status) = 'FAILED' THEN 1 END) as failed
			FROM tweets WHERE userId = ?`,
			[userId]
		);
		
		// Get upcoming posts in next 24h and 7d
		const now = Date.now();
		const in24h = now + (24 * 60 * 60 * 1000);
		const in7d = now + (7 * 24 * 60 * 60 * 1000);
		
		const upcomingResult = (db as any)['db'].queryOne(
			`SELECT 
				COUNT(CASE WHEN scheduledDate BETWEEN ? AND ? THEN 1 END) as in24h,
				COUNT(CASE WHEN scheduledDate BETWEEN ? AND ? THEN 1 END) as in7d
			FROM tweets WHERE userId = ? AND UPPER(status) = 'SCHEDULED'`,
			[now, in24h, now, in7d, userId]
		);
		
		// Calculate average posts per day (last 30 days)
		const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
		const postsLast30Days = (db as any)['db'].queryOne(
			"SELECT COUNT(*) as count FROM tweets WHERE userId = ? AND UPPER(status) = 'POSTED' AND createdAt >= ?",
			[userId, thirtyDaysAgo]
		);
		const avgPostsPerDay = postsLast30Days.count / 30;
		
		// Get last post time
		const lastPost = (db as any)['db'].queryOne(
			"SELECT MAX(createdAt) as time FROM tweets WHERE userId = ? AND UPPER(status) = 'POSTED'",
			[userId]
		);
		
		// Get next scheduled post
		const nextPost = (db as any)['db'].queryOne(
			"SELECT MIN(scheduledDate) as time FROM tweets WHERE userId = ? AND UPPER(status) = 'SCHEDULED'",
			[userId]
		);
		
		// Calculate queue health
		const queueHealth = calculateQueueHealth(userId, tweetsResult.scheduled, nextPost?.time);
		
		return {
			connectedAccounts: accountsResult.count,
			totalPublished: tweetsResult.published,
			totalScheduled: tweetsResult.scheduled,
			totalFailed: tweetsResult.failed,
			upcomingIn24h: upcomingResult.in24h,
			upcomingIn7d: upcomingResult.in7d,
			avgPostsPerDay: Math.round(avgPostsPerDay * 10) / 10, // Round to 1 decimal
			lastPostTime: lastPost.time ? new Date(lastPost.time) : null,
			nextScheduledPost: nextPost?.time ? new Date(nextPost.time) : null,
			queueHealth
		};
	} catch (error) {
		logger.error({ 
			error, 
			userId,
			errorMessage: error instanceof Error ? error.message : 'Unknown error',
			errorStack: error instanceof Error ? error.stack : undefined
		}, 'Failed to calculate activity summary');
		throw error;
	}
}

function calculateQueueHealth(userId: string, scheduledCount: number, nextPostTime: number | null): QueueHealth {
	if (scheduledCount === 0) {
		return {
			status: 'critical',
			message: 'No posts scheduled',
			scheduledThrough: null
		};
	}
	
	const db = getDbInstance();
	const lastScheduled = (db as any)['db'].queryOne(
		"SELECT MAX(scheduledDate) as time FROM tweets WHERE userId = ? AND UPPER(status) = 'SCHEDULED'",
		[userId]
	);
	
	if (!lastScheduled?.time) {
		return {
			status: 'warning',
			message: 'Queue status unknown',
			scheduledThrough: null
		};
	}
	
	const scheduledThrough = new Date(lastScheduled.time);
	const daysAhead = Math.floor((lastScheduled.time - Date.now()) / (24 * 60 * 60 * 1000));
	
	if (daysAhead >= 7) {
		return {
			status: 'healthy',
			message: `Scheduled through ${scheduledThrough.toLocaleDateString()}`,
			scheduledThrough
		};
	} else if (daysAhead >= 3) {
		return {
			status: 'warning',
			message: `Only scheduled through ${scheduledThrough.toLocaleDateString()}`,
			scheduledThrough
		};
	} else {
		return {
			status: 'critical',
			message: `Queue ends ${scheduledThrough.toLocaleDateString()}`,
			scheduledThrough
		};
	}
}

// ============================================================================
// Engagement Snapshot
// ============================================================================

/**
 * Calculates engagement metrics and trends.
 */
export async function calculateEngagementSnapshot(
	userId: string,
	dateRange: DateRange = '7d'
): Promise<EngagementSnapshotData> {
	const db = getDbInstance();
	const { startDate, endDate } = getDateRangeTimestamps(dateRange);
	
	try {
		// Get accounts for this user
		const accounts = (db as any)['db'].query(
			'SELECT id, providerAccountId FROM accounts WHERE userId = ?',
			[userId]
		);
		
		if (accounts.length === 0) {
			return getEmptyEngagementSnapshot();
		}
		
		const accountIds = accounts.map((a: any) => a.id);
		const placeholders = accountIds.map(() => '?').join(',');
		
		// Get current period stats (fallback to tweets if daily_stats is empty)
		let currentStats = (db as any)['db'].queryOne(
			`SELECT 
				AVG(engagement_rate) as avg_rate,
				SUM(followers) / COUNT(*) as avg_followers
			FROM daily_stats 
			WHERE account_id IN (${placeholders}) 
			AND date >= ? AND date <= ?`,
			[...accountIds, startDate, endDate]
		);
		
		// Fallback: Calculate from tweets table if daily_stats is empty
		// Note: impression_count not available in Free tier, so we calculate based on raw engagement
		if (!currentStats || currentStats.avg_rate === null) {
			const tweetsStats = (db as any)['db'].queryOne(
				`SELECT 
					COUNT(*) as tweet_count,
					AVG(likeCount + retweetCount + replyCount) as avg_engagement
				FROM tweets
				WHERE userId = ? AND UPPER(status) = 'POSTED'
				AND DATE(createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
				[userId, startDate, endDate]
			);
			
			// Use average engagement per tweet as a proxy for engagement rate
			const engagementRate = tweetsStats?.avg_engagement || 0;
			
			currentStats = { avg_rate: engagementRate, avg_followers: 0 };
		}
		
		// Get previous period stats (for comparison)
		const periodDays = getDaysInRange(dateRange);
		const prevStartDate = getPreviousPeriodStart(startDate, periodDays);
		const prevEndDate = startDate;
		
		let previousStats = (db as any)['db'].queryOne(
			`SELECT AVG(engagement_rate) as avg_rate
			FROM daily_stats 
			WHERE account_id IN (${placeholders}) 
			AND date >= ? AND date < ?`,
			[...accountIds, prevStartDate, prevEndDate]
		);
		
		// Fallback for previous period
		if (!previousStats || previousStats.avg_rate === null) {
			const prevTweetsStats = (db as any)['db'].queryOne(
				`SELECT 
					AVG(likeCount + retweetCount + replyCount) as avg_engagement
				FROM tweets
				WHERE userId = ? AND UPPER(status) = 'POSTED'
				AND DATE(createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
				[userId, prevStartDate, prevEndDate]
			);
			
			const prevEngagementRate = prevTweetsStats?.avg_engagement || 0;
			
			previousStats = { avg_rate: prevEngagementRate };
		}
		
		// Calculate change
		const currentRate = currentStats.avg_rate || 0;
		const previousRate = previousStats.avg_rate || 0;
		const changePercent = previousRate > 0 
			? ((currentRate - previousRate) / previousRate) * 100 
			: 0;
		
		const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';
		
		// Get most engaged post
		const mostEngagedPost = await getMostEngagedPost(userId, startDate, endDate);
		
		// Get top performing account
		const topAccount = await getTopPerformingAccount(userId, accountIds, startDate, endDate);
		
		return {
			currentEngagementRate: Math.round(currentRate * 100) / 100,
			previousEngagementRate: Math.round(previousRate * 100) / 100,
			changePercent: Math.round(changePercent * 10) / 10,
			trend,
			mostEngagedPost,
			topPerformingAccount: topAccount
		};
	} catch (error) {
		logger.error({ error, userId }, 'Failed to calculate engagement snapshot');
		return getEmptyEngagementSnapshot();
	}
}

async function getMostEngagedPost(userId: string, startDate: string, endDate: string): Promise<TopPost | null> {
	const db = getDbInstance();
	
	const post = (db as any)['db'].queryOne(
		`SELECT 
			t.id, t.content, t.likeCount, t.retweetCount, t.replyCount, 
			t.createdAt, t.twitterAccountId,
			a.username, a.profileImage,
			(t.likeCount + t.retweetCount + t.replyCount) as engagement_score
		FROM tweets t
		LEFT JOIN accounts a ON t.twitterAccountId = a.providerAccountId
		WHERE t.userId = ? AND LOWER(t.status) = 'posted' 
		AND DATE(t.createdAt / 1000, 'unixepoch') BETWEEN ? AND ?
		ORDER BY engagement_score DESC
		LIMIT 1`,
		[userId, startDate, endDate]
	);
	
	if (!post) return null;
	
	return {
		id: post.id,
		content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
		engagementScore: post.engagement_score,
		likeCount: post.likeCount || 0,
		retweetCount: post.retweetCount || 0,
		replyCount: post.replyCount || 0,
		postedAt: new Date(post.createdAt),
		accountUsername: post.username || 'Unknown',
		accountProfileImage: post.profileImage
	};
}

async function getTopPerformingAccount(
	userId: string,
	accountIds: string[],
	startDate: string,
	endDate: string
): Promise<TopAccount | null> {
	const db = getDbInstance();
	const placeholders = accountIds.map(() => '?').join(',');
	
	const account = (db as any)['db'].queryOne(
		`SELECT 
			ds.account_id,
			a.username,
			a.displayName,
			AVG(ds.engagement_rate) as avg_rate,
			SUM(ds.posts_count) as total_posts
		FROM daily_stats ds
		JOIN accounts a ON ds.account_id = a.id
		WHERE ds.account_id IN (${placeholders})
		AND ds.date BETWEEN ? AND ?
		GROUP BY ds.account_id, a.username, a.displayName
		HAVING total_posts > 0
		ORDER BY avg_rate DESC
		LIMIT 1`,
		[...accountIds, startDate, endDate]
	);
	
	if (!account) return null;
	
	return {
		id: account.account_id,
		username: account.username,
		displayName: account.displayName || account.username,
		engagementRate: Math.round(account.avg_rate * 100) / 100,
		postsCount: account.total_posts
	};
}

function getEmptyEngagementSnapshot(): EngagementSnapshotData {
	return {
		currentEngagementRate: 0,
		previousEngagementRate: 0,
		changePercent: 0,
		trend: 'stable',
		mostEngagedPost: null,
		topPerformingAccount: null
	};
}

// ============================================================================
// Content Mix
// ============================================================================

/**
 * Calculates content type distribution and patterns.
 */
export async function calculateContentMix(userId: string, dateRange: DateRange = '30d'): Promise<ContentMixData> {
	const db = getDbInstance();
	const { startDate, endDate } = getDateRangeTimestamps(dateRange);
	
	try {
		// Get post type distribution
		const distribution = await getPostTypeDistribution(userId, startDate, endDate);
		
		// Get top hashtags
		const hashtags = await getTopHashtags(userId, startDate, endDate);
		
		// Get posting time heatmap
		const heatmap = await getPostingTimeHeatmap(userId, startDate, endDate);
		
		return {
			postTypeDistribution: distribution,
			topHashtags: hashtags,
			postingTimeHeatmap: heatmap
		};
	} catch (error) {
		logger.error({ error, userId }, 'Failed to calculate content mix');
		throw error;
	}
}

async function getPostTypeDistribution(userId: string, startDate: string, endDate: string): Promise<PostTypeDistribution> {
	const db = getDbInstance();
	
	let result = (db as any)['db'].queryOne(
		`SELECT 
			SUM(CASE WHEN ca.has_video = 1 THEN 1 ELSE 0 END) as video,
			SUM(CASE WHEN ca.has_image = 1 THEN 1 ELSE 0 END) as image,
			SUM(CASE WHEN ca.has_gif = 1 THEN 1 ELSE 0 END) as gif,
			SUM(CASE WHEN ca.has_link = 1 THEN 1 ELSE 0 END) as link,
			SUM(CASE WHEN ca.has_video = 0 AND ca.has_image = 0 AND ca.has_gif = 0 THEN 1 ELSE 0 END) as text
		FROM content_analytics ca
		JOIN tweets t ON ca.tweet_id = t.id
		WHERE t.userId = ? AND UPPER(t.status) = 'POSTED'
		AND DATE(t.createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
		[userId, startDate, endDate]
	);
	
	// Fallback: Analyze tweets directly if content_analytics is empty
	if (!result || (result.text === 0 && result.image === 0 && result.video === 0 && result.gif === 0 && result.link === 0)) {
		const tweets = (db as any)['db'].query(
			`SELECT media, content FROM tweets 
			 WHERE userId = ? AND UPPER(status) = 'POSTED'
			 AND DATE(createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
			[userId, startDate, endDate]
		);
		
		let text = 0, image = 0, video = 0, gif = 0, link = 0;
		
		for (const tweet of tweets) {
			const media = tweet.media ? JSON.parse(tweet.media) : [];
			if (media.length === 0) {
				text++;
			} else {
				const mediaType = media[0]?.type || '';
				if (mediaType.includes('video')) video++;
				else if (mediaType.includes('image')) image++;
				else if (mediaType.includes('gif')) gif++;
			}
			if (tweet.content.includes('http://') || tweet.content.includes('https://')) {
				link++;
			}
		}
		
		return { text, image, video, gif, link };
	}
	
	return {
		text: result.text || 0,
		image: result.image || 0,
		video: result.video || 0,
		gif: result.gif || 0,
		link: result.link || 0
	};
}

async function getTopHashtags(userId: string, startDate: string, endDate: string, limit: number = 10): Promise<HashtagFrequency[]> {
	const db = getDbInstance();
	
	let results = (db as any)['db'].query(
		`SELECT ca.hashtags, ca.engagement_score
		FROM content_analytics ca
		JOIN tweets t ON ca.tweet_id = t.id
		WHERE t.userId = ? AND UPPER(t.status) = 'POSTED' AND ca.hashtag_count > 0
		AND DATE(t.createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
		[userId, startDate, endDate]
	);
	
	// Fallback: Extract hashtags from tweets directly
	if (results.length === 0) {
		results = (db as any)['db'].query(
			`SELECT content, likeCount, retweetCount, replyCount
			 FROM tweets
			 WHERE userId = ? AND UPPER(status) = 'POSTED'
			 AND DATE(createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
			[userId, startDate, endDate]
		);
		
		results = results.map((tweet: any) => ({
			hashtags: JSON.stringify((tweet.content.match(/#\w+/g) || []).map((tag: string) => tag.substring(1).toLowerCase())),
			engagement_score: (tweet.likeCount || 0) + (tweet.retweetCount || 0) + (tweet.replyCount || 0)
		})).filter((r: any) => r.hashtags !== '[]');
	}
	
	// Aggregate hashtag stats
	const hashtagMap = new Map<string, { count: number; totalEngagement: number }>();
	
	for (const row of results) {
		const hashtags = JSON.parse(row.hashtags || '[]');
		for (const tag of hashtags) {
			const existing = hashtagMap.get(tag) || { count: 0, totalEngagement: 0 };
			hashtagMap.set(tag, {
				count: existing.count + 1,
				totalEngagement: existing.totalEngagement + (row.engagement_score || 0)
			});
		}
	}
	
	// Convert to array and sort
	const hashtagArray: HashtagFrequency[] = Array.from(hashtagMap.entries())
		.map(([hashtag, stats]) => ({
			hashtag,
			count: stats.count,
			avgEngagement: Math.round(stats.totalEngagement / stats.count)
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
	
	return hashtagArray;
}

async function getPostingTimeHeatmap(userId: string, startDate: string, endDate: string): Promise<PostingTimeHeatmap> {
	const db = getDbInstance();
	
	let results = (db as any)['db'].query(
		`SELECT ca.post_hour, ca.post_day, AVG(ca.engagement_score) as avg_engagement, COUNT(*) as count
		FROM content_analytics ca
		JOIN tweets t ON ca.tweet_id = t.id
		WHERE t.userId = ? AND UPPER(t.status) = 'POSTED'
		AND DATE(t.createdAt / 1000, 'unixepoch') BETWEEN ? AND ?
		GROUP BY ca.post_hour, ca.post_day`,
		[userId, startDate, endDate]
	);
	
	// Fallback: Calculate from tweets directly
	if (results.length === 0) {
		const tweets = (db as any)['db'].query(
			`SELECT createdAt, likeCount, retweetCount, replyCount
			 FROM tweets
			 WHERE userId = ? AND UPPER(status) = 'POSTED'
			 AND DATE(createdAt / 1000, 'unixepoch') BETWEEN ? AND ?`,
			[userId, startDate, endDate]
		);
		
		const timeMap = new Map<string, { count: number; totalEngagement: number }>();
		
		for (const tweet of tweets) {
			const date = new Date(tweet.createdAt);
			const hour = date.getHours();
			const day = date.getDay();
			const key = `${day}-${hour}`;
			const engagement = (tweet.likeCount || 0) + (tweet.retweetCount || 0) + (tweet.replyCount || 0);
			
			const existing = timeMap.get(key) || { count: 0, totalEngagement: 0 };
			timeMap.set(key, {
				count: existing.count + 1,
				totalEngagement: existing.totalEngagement + engagement
			});
		}
		
		results = Array.from(timeMap.entries()).map(([key, stats]) => {
			const [day, hour] = key.split('-').map(Number);
			return {
				post_day: day,
				post_hour: hour,
				avg_engagement: stats.totalEngagement / stats.count,
				count: stats.count
			};
		});
	}
	
	// Initialize 7x24 matrix
	const data: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
	let maxValue = 0;
	let bestTime = { day: 0, hour: 0, avgEngagement: 0 };
	
	for (const row of results) {
		data[row.post_day][row.post_hour] = row.count;
		if (row.count > maxValue) {
			maxValue = row.count;
		}
		if (row.avg_engagement > bestTime.avgEngagement) {
			bestTime = {
				day: row.post_day,
				hour: row.post_hour,
				avgEngagement: row.avg_engagement
			};
		}
	}
	
	return {
		data,
		maxValue,
		bestTime
	};
}

// ============================================================================
// Performance Trends
// ============================================================================

/**
 * Calculates trend data for charts.
 */
export async function calculateTrends(userId: string, dateRange: DateRange = '30d'): Promise<TrendData> {
	const db = getDbInstance();
	const { startDate, endDate } = getDateRangeTimestamps(dateRange);
	
	try {
		// Get accounts for this user with their usernames and profile images
		const accounts = (db as any)['db'].query(
			'SELECT id, providerAccountId, username, profileImage FROM accounts WHERE userId = ?',
			[userId]
		);
		
		if (accounts.length === 0) {
			return { followerGrowth: [], engagementTrend: [], postsPerDay: [] };
		}
		
		const accountIds = accounts.map((a: any) => a.id);
		const placeholders = accountIds.map(() => '?').join(',');
		
		// Follower growth trend - per account
		const followerGrowthByAccount = [];
		
		for (const account of accounts) {
			let accountFollowerData = (db as any)['db'].query(
				`SELECT date, followers
				FROM daily_stats
				WHERE account_id = ?
				AND date BETWEEN ? AND ?
				ORDER BY date ASC`,
				[account.id, startDate, endDate]
			);
			
			// Fallback: Get current follower count from account table if daily_stats is empty
			if (accountFollowerData.length === 0) {
				const currentFollowers = account.followersCount || 0;
				const start = new Date(startDate);
				const end = new Date(endDate);
				accountFollowerData = [];
				
				// Generate data points showing stable count (will be updated by real sync)
				for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
					accountFollowerData.push({
						date: d.toISOString().split('T')[0],
						followers: currentFollowers
					});
				}
			}
			
			followerGrowthByAccount.push({
				accountId: account.providerAccountId,
				username: account.username,
				profileImage: account.profileImage,
				data: accountFollowerData.map((r: any) => ({ date: r.date, value: r.followers }))
			});
		}
		
		// Engagement trend
		let engagementData = (db as any)['db'].query(
			`SELECT date, AVG(engagement_rate) as avg_rate
			FROM daily_stats
			WHERE account_id IN (${placeholders})
			AND date BETWEEN ? AND ?
			GROUP BY date
			ORDER BY date ASC`,
			[...accountIds, startDate, endDate]
		);
		
		// Fallback: Calculate from tweets
		if (engagementData.length === 0) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			engagementData = [];
			for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
				const dayStr = d.toISOString().split('T')[0];
				const dayStats = (db as any)['db'].queryOne(
					`SELECT 
						AVG(likeCount + retweetCount + replyCount) as avg_engagement
					 FROM tweets
					 WHERE userId = ? AND UPPER(status) = 'POSTED'
					 AND DATE(createdAt / 1000, 'unixepoch') = ?`,
					[userId, dayStr]
				);
				
				const rate = dayStats?.avg_engagement || 0;
				
				engagementData.push({ date: dayStr, avg_rate: rate });
			}
		}
		
		// Posts per day
		let postsData = (db as any)['db'].query(
			`SELECT date, SUM(posts_count) as total_posts
			FROM daily_stats
			WHERE account_id IN (${placeholders})
			AND date BETWEEN ? AND ?
			GROUP BY date
			ORDER BY date ASC`,
			[...accountIds, startDate, endDate]
		);
		
		// Fallback: Count from tweets
		if (postsData.length === 0) {
			const start = new Date(startDate);
			const end = new Date(endDate);
			postsData = [];
			for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
				const dayStr = d.toISOString().split('T')[0];
				const count = (db as any)['db'].queryOne(
					`SELECT COUNT(*) as count FROM tweets
					 WHERE userId = ? AND UPPER(status) = 'POSTED'
					 AND DATE(createdAt / 1000, 'unixepoch') = ?`,
					[userId, dayStr]
				);
				
				postsData.push({ date: dayStr, total_posts: count?.count || 0 });
			}
		}
		
		return {
			followerGrowth: followerGrowthByAccount,
			engagementTrend: engagementData.map((r: any) => ({ date: r.date, value: Math.round(r.avg_rate * 100) / 100 })),
			postsPerDay: postsData.map((r: any) => ({ date: r.date, value: r.total_posts }))
		};
	} catch (error) {
		logger.error({ error, userId }, 'Failed to calculate trends');
		return { followerGrowth: [], engagementTrend: [], postsPerDay: [] };
	}
}

// ============================================================================
// System Status
// ============================================================================

/**
 * Gets system and account status information.
 */
export async function getSystemStatus(userId: string): Promise<SystemStatus> {
	const db = getDbInstance();
	
	try {
		// Get all accounts with their status
		const accounts = (db as any)['db'].query(
			`SELECT 
				a.id, a.username, a.expiresAt,
				MAX(t.createdAt) as last_post_time
			FROM accounts a
			LEFT JOIN tweets t ON a.providerAccountId = t.twitterAccountId AND UPPER(t.status) = 'POSTED'
			WHERE a.userId = ?
			GROUP BY a.id, a.username, a.expiresAt`,
			[userId]
		);
		
		const accountStatuses: AccountStatus[] = accounts.map((account: any) => {
			const now = Date.now();
			const expiresAt = account.expiresAt ? new Date(account.expiresAt * 1000) : null;
			const lastPostTime = account.last_post_time ? new Date(account.last_post_time) : null;
			
			let connectionStatus: 'active' | 'expired' | 'error' = 'active';
			if (expiresAt && expiresAt.getTime() < now) {
				connectionStatus = 'expired';
			}
			
			const daysInactive = lastPostTime 
				? Math.floor((now - lastPostTime.getTime()) / (24 * 60 * 60 * 1000))
				: 999;
			
			return {
				id: account.id,
				username: account.username,
				connectionStatus,
				tokenExpiresAt: expiresAt,
				lastPostTime,
				daysInactive
			};
		});
		
		// Get pending drafts count
		const draftsResult = (db as any)['db'].queryOne(
			"SELECT COUNT(*) as count FROM tweets WHERE userId = ? AND UPPER(status) = 'DRAFT'",
			[userId]
		);
		
		// Check if automation is enabled (queue settings)
		const queueSettings = (db as any)['db'].queryOne(
			'SELECT enabled FROM queue_settings WHERE userId = ?',
			[userId]
		);
		
		// Get last sync time from daily_stats
		const lastSync = (db as any)['db'].queryOne(
			`SELECT MAX(created_at) as time FROM daily_stats ds
			JOIN accounts a ON ds.account_id = a.id
			WHERE a.userId = ?`,
			[userId]
		);
		
		return {
			accounts: accountStatuses,
			pendingDrafts: draftsResult.count,
			automationEnabled: queueSettings?.enabled === 1,
			lastSyncTime: lastSync?.time ? new Date(lastSync.time) : null
		};
	} catch (error) {
		logger.error({ 
			error, 
			userId,
			errorMessage: error instanceof Error ? error.message : 'Unknown error',
			errorStack: error instanceof Error ? error.stack : undefined
		}, 'Failed to get system status');
		throw error;
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDateRangeTimestamps(range: DateRange): { startDate: string; endDate: string } {
	const end = new Date();
	const start = new Date();
	
	switch (range) {
		case '7d':
			start.setDate(start.getDate() - 7);
			break;
		case '30d':
			start.setDate(start.getDate() - 30);
			break;
		case '90d':
			start.setDate(start.getDate() - 90);
			break;
		case 'all':
			start.setFullYear(2020); // Far enough back
			break;
	}
	
	return {
		startDate: start.toISOString().split('T')[0],
		endDate: end.toISOString().split('T')[0]
	};
}

function getDaysInRange(range: DateRange): number {
	switch (range) {
		case '7d': return 7;
		case '30d': return 30;
		case '90d': return 90;
		case 'all': return 365;
	}
}

function getPreviousPeriodStart(currentStart: string, days: number): string {
	const date = new Date(currentStart);
	date.setDate(date.getDate() - days);
	return date.toISOString().split('T')[0];
}
