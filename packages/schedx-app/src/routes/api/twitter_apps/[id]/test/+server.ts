import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';
import { TwitterAuthService } from '$lib/server/twitterAuth';
import { TwitterApi } from 'twitter-api-v2';

const twitterAuth = TwitterAuthService.getInstance();

export const POST: RequestHandler = async ({ params, cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const appId = params.id;
		if (!appId) {
			return new Response(JSON.stringify({ error: 'App ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get the Twitter app
		const app = await db.getTwitterApp(appId);
		if (!app) {
			return new Response(JSON.stringify({ error: 'Twitter app not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Validate app configuration
		try {
			twitterAuth.validateAppConfig(app);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return new Response(
				JSON.stringify({
					error: `Invalid app configuration: ${errorMessage}`
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Test OAuth 1.0a credentials for media uploads
		const hasOAuth1Credentials = twitterAuth.hasOAuth1Credentials(app);

		if (!hasOAuth1Credentials) {
			return new Response(
				JSON.stringify({
					error: 'OAuth 1.0a credentials not configured',
					details: {
						missingCredentials: {
							consumerKey: !app.consumerKey,
							consumerSecret: !app.consumerSecret,
							accessToken: !app.accessToken,
							accessTokenSecret: !app.accessTokenSecret
						},
						message:
							'Media uploads require OAuth 1.0a credentials. Please configure Consumer Key, Consumer Secret, Access Token, and Access Token Secret in your Twitter app settings.'
					}
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Test OAuth 1.0a client creation
		try {
			const oauth1Client = new TwitterApi({
				appKey: app.consumerKey,
				appSecret: app.consumerSecret,
				accessToken: app.accessToken,
				accessSecret: app.accessTokenSecret
			});

			// Test a simple API call to verify credentials
			const me = await oauth1Client.v1.verifyCredentials();

			log.info('OAuth 1.0a credentials test successful', {
				appId: app.id,
				username: me.screen_name,
				userId: me.id_str
			});

			return new Response(
				JSON.stringify({
					success: true,
					message: 'OAuth 1.0a credentials are valid and ready for media uploads',
					user: {
						username: me.screen_name,
						userId: me.id_str,
						name: me.name
					}
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		} catch (error) {
			log.error('OAuth 1.0a credentials test failed:', {
				appId: app.id,
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			return new Response(
				JSON.stringify({
					error: 'OAuth 1.0a credentials are invalid',
					details: {
						message: error instanceof Error ? error.message : 'Unknown error',
						suggestion:
							'Please verify your Consumer Key, Consumer Secret, Access Token, and Access Token Secret in your Twitter Developer Portal.'
					}
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
	} catch (error) {
		log.error('Error testing Twitter app:', { error, appId: params.id });
		return new Response(JSON.stringify({ error: 'Failed to test app' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
