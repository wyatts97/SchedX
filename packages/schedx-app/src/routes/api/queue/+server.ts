import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance, getRawDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';
import { z } from 'zod';

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

// Validation schemas for queue operations
const reorderSchema = z.object({
	action: z.literal('reorder'),
	tweetIds: z.array(z.string()).min(1, 'At least one tweet ID required')
});

const moveSchema = z.object({
	action: z.literal('move'),
	tweetId: z.string(),
	newPosition: z.number().int().min(0)
});

const queueActionSchema = z.discriminatedUnion('action', [
	reorderSchema,
	moveSchema
]);

// POST: Queue management operations (reorder, move)
export const POST: RequestHandler = async ({ request, cookies }) => {
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

		const body = await request.json();
		const parseResult = queueActionSchema.safeParse(body);
		
		if (!parseResult.success) {
			return new Response(JSON.stringify({ 
				error: 'Invalid request',
				details: parseResult.error.errors.map(e => e.message)
			}), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const data = parseResult.data;
		const rawDb = getRawDbInstance();

		if (data.action === 'reorder') {
			// Reorder tweets based on the order of tweetIds array
			// The order in the array becomes the new queue position
			for (let i = 0; i < data.tweetIds.length; i++) {
				rawDb.execute(
					`UPDATE tweets SET queuePosition = ?, updatedAt = ? 
					 WHERE id = ? AND userId = ? AND status = ?`,
					[i, Date.now(), data.tweetIds[i], userId, TweetStatus.QUEUED]
				);
			}

			log.info('Queue reordered', { userId, count: data.tweetIds.length });

			return new Response(JSON.stringify({ 
				success: true, 
				message: `Reordered ${data.tweetIds.length} tweets` 
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (data.action === 'move') {
			// Move a single tweet to a specific position
			// First, get current positions
			const queuedTweets = rawDb.query(
				`SELECT id, queuePosition FROM tweets 
				 WHERE userId = ? AND status = ? 
				 ORDER BY queuePosition ASC`,
				[userId, TweetStatus.QUEUED]
			);

			// Find current position of the tweet
			const currentIndex = queuedTweets.findIndex((t: any) => t.id === data.tweetId);
			if (currentIndex === -1) {
				return new Response(JSON.stringify({ error: 'Tweet not found in queue' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Remove tweet from current position
			const [movedTweet] = queuedTweets.splice(currentIndex, 1);
			
			// Insert at new position
			const newPos = Math.min(data.newPosition, queuedTweets.length);
			queuedTweets.splice(newPos, 0, movedTweet);

			// Update all positions
			for (let i = 0; i < queuedTweets.length; i++) {
				rawDb.execute(
					`UPDATE tweets SET queuePosition = ?, updatedAt = ? WHERE id = ?`,
					[i, Date.now(), queuedTweets[i].id]
				);
			}

			log.info('Tweet moved in queue', { 
				userId, 
				tweetId: data.tweetId, 
				from: currentIndex, 
				to: newPos 
			});

			return new Response(JSON.stringify({ 
				success: true, 
				message: `Moved tweet from position ${currentIndex} to ${newPos}` 
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(JSON.stringify({ error: 'Unknown action' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});

	} catch (error) {
		log.error('Queue operation error', { error });
		return new Response(JSON.stringify({
			error: 'Failed to perform queue operation',
			details: error instanceof Error ? error.message : 'Unknown error'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
