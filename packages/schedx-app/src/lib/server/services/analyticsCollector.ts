/**
 * Analytics Collector Service
 * 
 * Collects engagement data from Twitter API and stores in SQLite for dashboard analytics.
 * Designed to run daily via cron job with rate limit awareness.
 */

import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import { TwitterApi } from 'twitter-api-v2';
import { nanoid } from 'nanoid';
import type { ContentAnalytics, DailyStats, EngagementSnapshot } from '$lib/types/analytics';

// ============================================================================
// Daily Stats Collection
// ============================================================================

/**
 * Collects daily engagement statistics for a specific account.
 * 
 * This function:
 * 1. Fetches recent tweets from Twitter API
 * 2. Aggregates engagement metrics
 * 3. Stores daily snapshot in database
 * 
 * @param accountId - Database account ID (not Twitter ID)
 * @returns Success status and stats collected
 */
export async function collectDailyStats(accountId: string): Promise<{
	success: boolean;
	stats?: DailyStats;
	error?: string;
}> {
	try {
		const db = getDbInstance();
		
		// Get account details
		const account = await db.getUserAccountById(accountId);
		if (!account) {
			return { success: false, error: 'Account not found' };
		}

		// Check if account has valid tokens
		if (!account.access_token) {
			return { success: false, error: 'Account has no access token' };
		}

		// Initialize Twitter client
		const client = new TwitterApi(account.access_token);
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

		// Check if we already have stats for today
		const existingStats = (db as any)['db'].queryOne(
			'SELECT * FROM daily_stats WHERE account_id = ? AND date = ?',
			[accountId, today]
		);

		if (existingStats) {
			logger.info({ accountId, date: today }, 'Daily stats already collected for today');
			return { success: true, stats: mapDailyStats(existingStats) };
		}

		// Fetch user info (for follower count)
		const userInfo = await client.v2.me({
			'user.fields': ['public_metrics']
		});

		const followers = userInfo.data.public_metrics?.followers_count || 0;
		const following = userInfo.data.public_metrics?.following_count || 0;

		// Fetch recent tweets (last 24 hours)
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		
		const tweets = await client.v2.userTimeline(userInfo.data.id, {
			max_results: 100,
			'tweet.fields': ['public_metrics', 'created_at', 'attachments'],
			start_time: yesterday.toISOString(),
			end_time: new Date().toISOString()
		});

		// Aggregate engagement metrics
		let totalLikes = 0;
		let totalReplies = 0;
		let totalRetweets = 0;
		let totalImpressions = 0;
		let topTweetId: string | null = null;
		let maxEngagement = 0;

		for (const tweet of tweets.data.data || []) {
			const metrics = tweet.public_metrics;
			if (metrics) {
				totalLikes += metrics.like_count || 0;
				totalReplies += metrics.reply_count || 0;
				totalRetweets += metrics.retweet_count || 0;
				totalImpressions += metrics.impression_count || 0;

				const engagement = (metrics.like_count || 0) + (metrics.reply_count || 0) + (metrics.retweet_count || 0);
				if (engagement > maxEngagement) {
					maxEngagement = engagement;
					topTweetId = tweet.id;
				}
			}
		}

		// Calculate engagement rate
		const engagementRate = followers > 0
			? ((totalLikes + totalReplies + totalRetweets) / followers) * 100
			: 0;

		// Store in database
		const statsId = nanoid();
		(db as any)['db'].execute(
			`INSERT INTO daily_stats (
				id, account_id, date, followers, following,
				total_likes, total_replies, total_retweets, total_impressions,
				engagement_rate, top_tweet_id, posts_count, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				statsId,
				accountId,
				today,
				followers,
				following,
				totalLikes,
				totalReplies,
				totalRetweets,
				totalImpressions,
				engagementRate,
				topTweetId,
				tweets.data.data?.length || 0,
				Date.now()
			]
		);

		const stats: DailyStats = {
			id: statsId,
			accountId,
			date: today,
			followers,
			following,
			totalLikes,
			totalReplies,
			totalRetweets,
			totalImpressions,
			engagementRate,
			topTweetId,
			postsCount: tweets.data.data?.length || 0,
			createdAt: new Date()
		};

		logger.info({ accountId, date: today, stats }, 'Daily stats collected successfully');
		return { success: true, stats };

	} catch (error) {
		logger.error({ error, accountId }, 'Failed to collect daily stats');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

// ============================================================================
// Content Analytics
// ============================================================================

/**
 * Analyzes content composition of a tweet and stores metrics.
 * 
 * This should be called when a tweet is created or posted.
 * 
 * @param tweetId - Database tweet ID
 * @returns Success status
 */
export async function analyzeContentMetrics(tweetId: string): Promise<{
	success: boolean;
	analytics?: ContentAnalytics;
	error?: string;
}> {
	try {
		const db = getDbInstance();
		
		// Get tweet details
		const tweet = await (db as any).getTweetById(tweetId);
		if (!tweet) {
			return { success: false, error: 'Tweet not found' };
		}

		// Parse media
		const media = tweet.media ? JSON.parse(tweet.media) : [];
		const hasImage = media.some((m: any) => m.type === 'photo' || m.type === 'image');
		const hasVideo = media.some((m: any) => m.type === 'video');
		const hasGif = media.some((m: any) => m.type === 'gif');
		
		// Detect links
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const hasLink = urlRegex.test(tweet.content);

		// Extract hashtags
		const hashtagRegex = /#(\w+)/g;
		const hashtags = [...tweet.content.matchAll(hashtagRegex)].map(m => m[1]);

		// Count mentions
		const mentionRegex = /@(\w+)/g;
		const mentionCount = (tweet.content.match(mentionRegex) || []).length;

		// Get posting time
		const postDate = new Date(tweet.createdAt);
		const postHour = postDate.getHours();
		const postDay = postDate.getDay(); // 0=Sunday

		// Calculate engagement score
		const engagementScore = (tweet.likeCount || 0) + (tweet.retweetCount || 0) + (tweet.replyCount || 0);

		// Check if analytics already exist
		const existing = (db as any)['db'].queryOne(
			'SELECT * FROM content_analytics WHERE tweet_id = ?',
			[tweetId]
		);

		if (existing) {
			// Update existing record
			(db as any)['db'].execute(
				`UPDATE content_analytics SET
					has_image = ?, has_video = ?, has_gif = ?, has_link = ?,
					media_count = ?, hashtag_count = ?, hashtags = ?,
					mention_count = ?, char_count = ?, post_hour = ?, post_day = ?,
					post_timestamp = ?, engagement_score = ?
				WHERE tweet_id = ?`,
				[
					hasImage ? 1 : 0,
					hasVideo ? 1 : 0,
					hasGif ? 1 : 0,
					hasLink ? 1 : 0,
					media.length,
					hashtags.length,
					JSON.stringify(hashtags),
					mentionCount,
					tweet.content.length,
					postHour,
					postDay,
					postDate.getTime(),
					engagementScore,
					tweetId
				]
			);
		} else {
			// Insert new record
			const analyticsId = nanoid();
			(db as any)['db'].execute(
				`INSERT INTO content_analytics (
					id, tweet_id, has_image, has_video, has_gif, has_link,
					media_count, hashtag_count, hashtags, mention_count, char_count,
					post_hour, post_day, post_timestamp, engagement_score, created_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					analyticsId,
					tweetId,
					hasImage ? 1 : 0,
					hasVideo ? 1 : 0,
					hasGif ? 1 : 0,
					hasLink ? 1 : 0,
					media.length,
					hashtags.length,
					JSON.stringify(hashtags),
					mentionCount,
					tweet.content.length,
					postHour,
					postDay,
					postDate.getTime(),
					engagementScore,
					Date.now()
				]
			);
		}

		const analytics: ContentAnalytics = {
			id: existing?.id || nanoid(),
			tweetId,
			hasImage,
			hasVideo,
			hasGif,
			hasLink,
			mediaCount: media.length,
			hashtagCount: hashtags.length,
			hashtags,
			mentionCount,
			charCount: tweet.content.length,
			postHour,
			postDay,
			postTimestamp: postDate,
			engagementScore,
			createdAt: new Date()
		};

		logger.info({ tweetId, analytics }, 'Content analytics updated');
		return { success: true, analytics };

	} catch (error) {
		logger.error({ error, tweetId }, 'Failed to analyze content metrics');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

// ============================================================================
// Engagement Snapshots
// ============================================================================

/**
 * Creates an engagement snapshot for a tweet.
 * 
 * This tracks how engagement metrics change over time.
 * Should be called daily for tweets posted in the last 7 days.
 * 
 * @param tweetId - Database tweet ID
 * @returns Success status
 */
export async function createEngagementSnapshot(tweetId: string): Promise<{
	success: boolean;
	snapshot?: EngagementSnapshot;
	error?: string;
}> {
	try {
		const db = getDbInstance();
		
		// Get tweet details
		const tweet = await (db as any).getTweetById(tweetId);
		if (!tweet) {
			return { success: false, error: 'Tweet not found' };
		}

		const today = new Date().toISOString().split('T')[0];

		// Check if snapshot already exists for today
		const existing = (db as any)['db'].queryOne(
			'SELECT * FROM engagement_snapshots WHERE tweet_id = ? AND snapshot_date = ?',
			[tweetId, today]
		);

		if (existing) {
			logger.debug({ tweetId, date: today }, 'Engagement snapshot already exists');
			return { success: true, snapshot: mapEngagementSnapshot(existing) };
		}

		// Insert new snapshot
		const snapshotId = nanoid();
		(db as any)['db'].execute(
			`INSERT INTO engagement_snapshots (
				id, tweet_id, snapshot_date,
				like_count, retweet_count, reply_count, impression_count,
				created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				snapshotId,
				tweetId,
				today,
				tweet.likeCount || 0,
				tweet.retweetCount || 0,
				tweet.replyCount || 0,
				tweet.impressionCount || 0,
				Date.now()
			]
		);

		const snapshot: EngagementSnapshot = {
			id: snapshotId,
			tweetId,
			snapshotDate: today,
			likeCount: tweet.likeCount || 0,
			retweetCount: tweet.retweetCount || 0,
			replyCount: tweet.replyCount || 0,
			impressionCount: tweet.impressionCount || 0,
			createdAt: new Date()
		};

		logger.info({ tweetId, date: today }, 'Engagement snapshot created');
		return { success: true, snapshot };

	} catch (error) {
		logger.error({ error, tweetId }, 'Failed to create engagement snapshot');
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Collects daily stats for all active accounts.
 * 
 * This is the main function called by the cron job.
 * 
 * @returns Summary of collection results
 */
export async function collectAllAccountsStats(): Promise<{
	success: number;
	failed: number;
	errors: string[];
}> {
	const db = getDbInstance();
	const accounts = await (db as any).getAllUserAccounts();
	
	let success = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const account of accounts) {
		const result = await collectDailyStats(account.id);
		if (result.success) {
			success++;
		} else {
			failed++;
			errors.push(`${account.username}: ${result.error}`);
		}

		// Rate limit: wait 1 second between accounts
		await new Promise(resolve => setTimeout(resolve, 1000));
	}

	logger.info({ success, failed, total: accounts.length }, 'Daily stats collection completed');
	return { success, failed, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapDailyStats(row: any): DailyStats {
	return {
		id: row.id,
		accountId: row.account_id,
		date: row.date,
		followers: row.followers,
		following: row.following,
		totalLikes: row.total_likes,
		totalReplies: row.total_replies,
		totalRetweets: row.total_retweets,
		totalImpressions: row.total_impressions,
		engagementRate: row.engagement_rate,
		topTweetId: row.top_tweet_id,
		postsCount: row.posts_count,
		createdAt: new Date(row.created_at)
	};
}

function mapEngagementSnapshot(row: any): EngagementSnapshot {
	return {
		id: row.id,
		tweetId: row.tweet_id,
		snapshotDate: row.snapshot_date,
		likeCount: row.like_count,
		retweetCount: row.retweet_count,
		replyCount: row.reply_count,
		impressionCount: row.impression_count,
		createdAt: new Date(row.created_at)
	};
}
