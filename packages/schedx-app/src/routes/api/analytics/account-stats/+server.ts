import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RettiwtService } from '$lib/server/rettiwtService';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * GET /api/analytics/account-stats
 * Fetch real-time account statistics using Rettiwt-API
 * Returns follower counts, engagement metrics, and profile data for all connected accounts
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDbInstance();
		
		// Get all Twitter accounts for the user
		const accounts = (db as any)['db'].query(
			`SELECT * FROM accounts WHERE userId = ? AND provider = 'twitter'`,
			[user.id]
		);

		if (accounts.length === 0) {
			return json({
				accounts: [],
				totalFollowers: 0,
				totalEngagement: 0
			});
		}

		logger.debug({ userId: user.id, accountCount: accounts.length }, 'Fetching account stats via Rettiwt');

		// Fetch analytics for each account in parallel
		const accountStats = await Promise.all(
			accounts.map(async (account: any) => {
				try {
					if (!account.username) {
						return null;
					}

					const analytics = await RettiwtService.getUserAnalytics(account.username, user.id);

					return {
						accountId: account.id,
						username: analytics.username,
						displayName: analytics.displayName,
						profileImage: analytics.profileImage,
						profileBanner: analytics.profileBanner,
						followers: analytics.followers,
						following: analytics.following,
						tweetsCount: analytics.tweetsCount,
						verified: analytics.verified,
						bio: analytics.bio,
						createdAt: analytics.createdAt,
						recentTweets: analytics.recentTweets,
						totalLikes: analytics.totalLikes,
						totalRetweets: analytics.totalRetweets,
						totalReplies: analytics.totalReplies,
						totalViews: analytics.totalViews,
						avgEngagement: analytics.avgEngagement,
						engagementRate: analytics.engagementRate
					};
				} catch (err) {
					logger.error({
						error: err,
						accountId: account.id,
						username: account.username
					}, 'Failed to fetch account stats via Rettiwt');
					return null;
				}
			})
		);

		// Filter out failed accounts
		const validStats = accountStats.filter(stat => stat !== null);

		// Calculate totals
		const totalFollowers = validStats.reduce((sum, stat) => sum + (stat?.followers || 0), 0);
		const totalEngagement = validStats.reduce((sum, stat) => 
			sum + (stat?.totalLikes || 0) + (stat?.totalRetweets || 0) + (stat?.totalReplies || 0), 0
		);

		return json({
			accounts: validStats,
			totalFollowers,
			totalEngagement,
			timestamp: new Date().toISOString()
		});
	} catch (err) {
		logger.error({ error: err, userId: user.id }, 'Failed to fetch account stats');
		throw error(500, 'Failed to fetch account statistics');
	}
};
