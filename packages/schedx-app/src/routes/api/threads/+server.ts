import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { TweetStatus } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';

// POST: Create a new thread
export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const userId = 'admin';
		const body = await request.json();

		const { tweets, scheduledDate, accountId, action, title } = body;

		if (!tweets || !Array.isArray(tweets) || tweets.length < 2) {
			return new Response(
				JSON.stringify({ error: 'Thread must have at least 2 tweets' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		if (tweets.length > 25) {
			return new Response(
				JSON.stringify({ error: 'Thread cannot exceed 25 tweets' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const thread = {
			userId,
			title: title || `Thread (${tweets.length} tweets)`,
			twitterAccountId: accountId,
			scheduledDate: action === 'schedule' ? new Date(scheduledDate) : new Date(),
			status: action === 'schedule' ? TweetStatus.SCHEDULED : action === 'queue' ? TweetStatus.QUEUED : TweetStatus.DRAFT,
			tweets: tweets.map((t: any, index: number) => ({
				content: t.content,
				media: t.media || [],
				position: index + 1
			}))
		};

		const threadId = await db.saveThread(thread);

		log.info('Thread created successfully', {
			threadId,
			tweetCount: tweets.length,
			action
		});

		return new Response(
			JSON.stringify({
				id: threadId,
				success: true,
				message: `Thread ${action === 'schedule' ? 'scheduled' : action === 'queue' ? 'queued' : 'saved'} successfully`
			}),
			{
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error creating thread', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to create thread',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

// GET: Fetch threads
export const GET: RequestHandler = async ({ url, cookies }) => {
	try {
		const adminSession = cookies.get('admin_session');
		if (!adminSession) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const userId = 'admin';
		const status = url.searchParams.get('status');

		const threads = await db.getThreads(userId, status);

		return new Response(
			JSON.stringify({
				threads,
				success: true
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error fetching threads', { error });
		return new Response(
			JSON.stringify({
				error: 'Failed to fetch threads',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};