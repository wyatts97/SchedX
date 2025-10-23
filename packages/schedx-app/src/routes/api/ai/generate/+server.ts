import type { RequestHandler } from '@sveltejs/kit';
import { OpenRouterService } from '$lib/server/openRouterService';
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
		log.debug('POST /api/ai/generate - Request received');
		const body = await request.json();
		log.debug('POST /api/ai/generate - Body parsed', { hasPrompt: !!body.prompt });
		
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
		log.debug('POST /api/ai/generate - DB instance retrieved');
		
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			log.warn('POST /api/ai/generate - Invalid session');
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const userId = session.data.user.id;
		log.debug('POST /api/ai/generate - User authenticated', { userId });

		// Get OpenRouter settings
		const openRouterSettings = await db.getOpenRouterSettings(userId);
		log.debug('POST /api/ai/generate - Settings retrieved', { 
			hasSettings: !!openRouterSettings,
			enabled: openRouterSettings?.enabled 
		});
		
		if (!openRouterSettings || !openRouterSettings.enabled) {
			return new Response(
				JSON.stringify({ 
					error: 'OpenRouter is not configured. Please configure it in Admin Settings.' 
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Generate tweet using OpenRouter service
		log.debug('POST /api/ai/generate - Calling OpenRouter service');
		const openRouterService = OpenRouterService.getInstance();
		const generatedTweet = await openRouterService.generateTweet(
			{
				prompt,
				tone,
				length,
				context,
				userId
			},
			{
				apiKey: openRouterSettings.apiKey,
				model: openRouterSettings.model,
				temperature: openRouterSettings.temperature,
				maxTokens: openRouterSettings.maxTokens
			}
		);

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
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		log.error('AI generation error', {
			error: errorMsg,
			stack: errorStack
		});
		console.error('POST /api/ai/generate error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Failed to generate tweet';

		return new Response(
			JSON.stringify({
				error: errorMessage,
				details: errorMsg
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
});
