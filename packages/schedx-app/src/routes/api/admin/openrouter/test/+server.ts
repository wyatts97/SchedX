import type { RequestHandler } from '@sveltejs/kit';
import { log } from '$lib/server/logger';

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
		const { apiKey, model } = body;

		if (!apiKey || !apiKey.trim()) {
			return new Response(
				JSON.stringify({ error: 'API key is required' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Test the OpenRouter API with a simple request
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://schedx.app',
				'X-Title': 'SchedX'
			},
			body: JSON.stringify({
				model: model || 'meta-llama/llama-4-scout:free',
				messages: [
					{
						role: 'user',
						content: 'Say "test successful" in exactly two words.'
					}
				],
				max_tokens: 10
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			log.error('OpenRouter API test failed', {
				status: response.status,
				error: errorText
			});
			
			if (response.status === 401) {
				return new Response(
					JSON.stringify({ error: 'Invalid API key' }),
					{ status: 400, headers: { 'Content-Type': 'application/json' } }
				);
			}
			
			return new Response(
				JSON.stringify({ error: 'API test failed' }),
				{ status: 500, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const data = await response.json();
		log.info('OpenRouter API test successful', { model });

		return new Response(
			JSON.stringify({ success: true, response: data }),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		log.error('Failed to test OpenRouter connection', {
			error: error instanceof Error ? error.message : String(error)
		});
		
		return new Response(
			JSON.stringify({ error: 'Connection test failed' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
