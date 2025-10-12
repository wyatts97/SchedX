import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { Tweet } from '@schedx/shared-lib/types/types';
import logger from '$lib/server/logger';
import { z } from 'zod';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';
import { validateAccountOwnership, validateScheduledDate } from '$lib/validation/accountValidation';
import { getAdminUserId } from '$lib/server/adminCache';

// Update tweet validation schema
const updateTweetSchema = z.object({
	content: z
		.string()
		.min(1, 'Tweet content is required')
		.max(280, 'Tweet content cannot exceed 280 characters'),
	accountId: z.string().min(1, 'Invalid account ID'),
	scheduledDate: z.coerce.date().optional(),
	media: z
		.array(
			z.object({
				url: z.string().min(1),
				type: z.enum(['photo', 'gif', 'video'])
			})
		)
		.optional()
		.default([])
});

export const PUT: RequestHandler = userRateLimit(RATE_LIMITS.tweets)(
	createValidationMiddleware(updateTweetSchema)(async (data, event) => {
		const { cookies, params } = event;
		const adminSession = cookies.get('admin_session');

		if (!adminSession || adminSession.trim() === '') {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		try {
			const db = getDbInstance() as any;
			const adminUserId = await getAdminUserId();
			
			if (!adminUserId) {
				return new Response(JSON.stringify({ error: 'Admin user not found' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			
			const tweetId = params.id as string;

			if (!tweetId) {
				return new Response(JSON.stringify({ error: 'Tweet ID is required' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Get existing tweet to verify ownership
			const existingTweet = await db.getTweetById(tweetId);
			if (!existingTweet) {
				return new Response(JSON.stringify({ error: 'Tweet not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Verify the tweet belongs to this admin user
			if (existingTweet.userId !== adminUserId) {
				return new Response(JSON.stringify({ error: 'Unauthorized to edit this tweet' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Validate account ownership
			const accountValidation = await validateAccountOwnership(data.accountId, adminUserId);
			if (!accountValidation.valid) {
				return new Response(JSON.stringify({ error: accountValidation.error }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			// Validate scheduled date if provided
			if (data.scheduledDate) {
				const dateValidation = validateScheduledDate(data.scheduledDate);
				if (!dateValidation.valid) {
					return new Response(JSON.stringify({ error: dateValidation.error }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			// Update the tweet
			const updatedTweet = {
				content: data.content,
				twitterAccountId: data.accountId,
				scheduledDate: data.scheduledDate || new Date(existingTweet.scheduledDate),
				media: data.media || [],
				updatedAt: new Date()
			};

			await db.updateTweet(tweetId, updatedTweet);

			logger.info('Tweet updated successfully');

			return new Response(
				JSON.stringify({
					success: true,
					message: 'Tweet updated successfully',
					tweetId
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		} catch (error: any) {
			logger.error('Error updating tweet');
			return new Response(
				JSON.stringify({
					error: error.message || 'Failed to update tweet'
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
	})
);

export const DELETE: RequestHandler = async (event) => {
	const { cookies, params } = event;
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const db = getDbInstance() as any;
		const adminUserId = await getAdminUserId();
		
		if (!adminUserId) {
			return new Response(JSON.stringify({ error: 'Admin user not found' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		const tweetId = params.id as string;

		if (!tweetId) {
			return new Response(JSON.stringify({ error: 'Tweet ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

			// Get existing tweet to verify ownership
		const existingTweet = await db.getTweetById(tweetId);
		if (!existingTweet) {
			return new Response(JSON.stringify({ error: 'Tweet not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Verify the tweet belongs to this admin user
		if (existingTweet.userId !== adminUserId) {
			return new Response(JSON.stringify({ error: 'Unauthorized to delete this tweet' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		await db.deleteTweet(tweetId, adminUserId);

		logger.info('Tweet deleted successfully');

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Tweet deleted successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error: any) {
		logger.error('Error deleting tweet');
		return new Response(
			JSON.stringify({
				error: error.message || 'Failed to delete tweet'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
