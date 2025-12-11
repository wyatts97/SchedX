import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';

// Helper to get user ID from session
async function getUserIdFromSession(adminSession: string): Promise<string | null> {
	const db = getDbInstance();
	const session = await db.getSession(adminSession);
	return session?.data?.user?.id || null;
}

// GET: Fetch queued tweets
export const GET: RequestHandler = async ({ cookies, url }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const userId = await getUserIdFromSession(adminSession);
		if (!userId) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		// Get optional account filter from query params
		const accountId = url.searchParams.get('accountId') || undefined;

		// Get queued tweets, optionally filtered by account
		let tweets;
		if (accountId) {
			// Filter by specific account
			const allTweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);
			tweets = allTweets.filter((t: any) => t.twitterAccountId === accountId);
		} else {
			// Get all queued tweets
			tweets = await db.getTweetsByStatus(userId, TweetStatus.QUEUED);
		}

		// Sort by queue position
		tweets.sort((a: any, b: any) => (a.queuePosition || 0) - (b.queuePosition || 0));

		log.info('Fetched queued tweets', { count: tweets.length, accountId });

		return new Response(
			JSON.stringify({
				tweets,
				success: true
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error fetching queued tweets', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch queued tweets',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
