import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

const db = getDbInstance();

export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');
	
	if (!adminSession || adminSession.trim() === '') {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		// For now, we use a fixed admin user ID
		// In a multi-user system, you'd get this from the session
		const userId = 'admin';
		
		const settings = await db.getOpenRouterSettings(userId);
		
		if (!settings) {
			return new Response(
				JSON.stringify({ settings: { enabled: false, apiKey: '', defaultModel: 'meta-llama/llama-4-scout:free' } }),
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
		const body = await request.json();
		const { enabled, apiKey, defaultModel } = body;

		// Validate input
		if (enabled && (!apiKey || !apiKey.trim())) {
			return new Response(
				JSON.stringify({ error: 'API key is required when enabled' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		if (enabled && !apiKey.startsWith('sk-or-')) {
			return new Response(
				JSON.stringify({ error: 'Invalid API key format' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// For now, we use a fixed admin user ID
		const userId = 'admin';
		
		await db.saveOpenRouterSettings({
			userId,
			apiKey: apiKey || '',
			defaultModel: defaultModel || 'meta-llama/llama-4-scout:free',
			enabled: Boolean(enabled)
		});

		log.info('OpenRouter settings saved', { userId, enabled, defaultModel });

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
