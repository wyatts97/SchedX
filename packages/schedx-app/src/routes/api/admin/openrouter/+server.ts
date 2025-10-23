import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');
	
	if (!adminSession || adminSession.trim() === '') {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		const db = getDbInstance();
		log.debug('GET /api/admin/openrouter - DB instance retrieved');
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			log.warn('GET /api/admin/openrouter - Invalid session');
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		const userId = session.data.user.id;
		log.debug('GET /api/admin/openrouter - User authenticated', { userId });
		
		const settings = await db.getOpenRouterSettings(userId);
		log.debug('GET /api/admin/openrouter - Settings retrieved', { hasSettings: !!settings });
		
		if (!settings) {
			return new Response(
				JSON.stringify({ 
					settings: { 
						enabled: false, 
						apiKey: '', 
						model: 'openai/gpt-3.5-turbo',
						temperature: 0.8,
						maxTokens: 150
					} 
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			);
		}

		return new Response(
			JSON.stringify({ settings }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		log.error('Failed to get OpenRouter settings', {
			error: errorMsg,
			stack: errorStack
		});
		console.error('GET /api/admin/openrouter error:', error);
		
		return new Response(
			JSON.stringify({ 
				error: 'Failed to load settings',
				details: errorMsg 
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const adminSession = cookies.get('admin_session');
	
	if (!adminSession || adminSession.trim() === '') {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		const db = getDbInstance();
		log.debug('POST /api/admin/openrouter - DB instance retrieved');
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			log.warn('POST /api/admin/openrouter - Invalid session');
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		const userId = session.data.user.id;
		log.debug('POST /api/admin/openrouter - User authenticated', { userId });
		
		const body = await request.json();
		const { enabled, apiKey, model, temperature, maxTokens } = body;
		log.debug('POST /api/admin/openrouter - Request body parsed', { enabled, model });

		// Validate input
		if (enabled && (!apiKey || !apiKey.trim())) {
			return new Response(
				JSON.stringify({ error: 'API key is required when enabled' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		if (enabled && !apiKey.startsWith('sk-or-')) {
			return new Response(
				JSON.stringify({ error: 'Invalid API key format. OpenRouter keys start with sk-or-' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		await db.saveOpenRouterSettings({
			userId,
			apiKey: apiKey || '',
			model: model || 'openai/gpt-3.5-turbo',
			temperature: temperature !== undefined ? temperature : 0.8,
			maxTokens: maxTokens !== undefined ? maxTokens : 150,
			enabled: Boolean(enabled)
		});

		log.info('OpenRouter settings saved', { userId, enabled, model });

		return new Response(
			JSON.stringify({ success: true }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		log.error('Failed to save OpenRouter settings', {
			error: errorMsg,
			stack: errorStack
		});
		console.error('POST /api/admin/openrouter error:', error);
		
		return new Response(
			JSON.stringify({ 
				error: 'Failed to save settings',
				details: errorMsg 
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
