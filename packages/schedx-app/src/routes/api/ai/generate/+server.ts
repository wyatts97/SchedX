import type { RequestHandler } from '@sveltejs/kit';
import { AIService } from '$lib/server/aiService';
import { log } from '$lib/server/logger';
import { z } from 'zod';
import { userRateLimit, RATE_LIMITS } from '$lib/rate-limiting';

// Validation schema for AI generation request
const generateSchema = z.object({
	prompt: z.string().min(1, 'Prompt is required').max(500, 'Prompt is too long'),
	tone: z.enum(['casual', 'professional', 'funny', 'inspirational', 'informative']).optional(),
	length: z.enum(['short', 'medium', 'long']).optional(),
	context: z.string().max(1000).optional()
});

export const POST: RequestHandler = userRateLimit({
	...RATE_LIMITS.tweets,
	maxRequests: 20, // Allow 20 AI generations per minute
	windowMs: 60 * 1000
})(async ({ request, cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const body = await request.json();
		
		// Validate request
		const validationResult = generateSchema.safeParse(body);
		if (!validationResult.success) {
			return new Response(
				JSON.stringify({
					error: 'Invalid request',
					details: validationResult.error.errors
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const { prompt, tone, length, context } = validationResult.data;

		log.info('AI tweet generation requested', {
			promptLength: prompt.length,
			tone: tone || 'default',
			length: length || 'default'
		});

		// Get user from session
		const db = (await import('$lib/server/db')).getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Generate tweet using AI service
		const aiService = AIService.getInstance();
		const generatedTweet = await aiService.generateTweet({
			prompt,
			tone,
			length,
			context,
			userId: session.data.user.id
		});

		return new Response(
			JSON.stringify({
				success: true,
				tweet: generatedTweet
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('AI generation error', {
			error: error instanceof Error ? error.message : String(error)
		});

		const errorMessage = error instanceof Error ? error.message : 'Failed to generate tweet';

		return new Response(
			JSON.stringify({
				error: errorMessage
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
});
