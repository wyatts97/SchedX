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
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		const userId = session.data.user.id;
		
		const settings = await db.getOpenRouterSettings(userId);
		
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
		log.error('Failed to get OpenRouter settings', {
			error: error instanceof Error ? error.message : String(error)
		});
		
		return new Response(
			JSON.stringify({ error: 'Failed to load settings' }),
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
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		const userId = session.data.user.id;
		
		const body = await request.json();
		const { enabled, apiKey, model, temperature, maxTokens } = body;

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
		log.error('Failed to save OpenRouter settings', {
			error: error instanceof Error ? error.message : String(error)
		});
		
		return new Response(
			JSON.stringify({ error: 'Failed to save settings' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
