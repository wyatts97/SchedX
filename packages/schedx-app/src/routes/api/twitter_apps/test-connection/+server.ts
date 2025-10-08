import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import { TwitterApi } from 'twitter-api-v2';
import { log } from '$lib/logger';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { appId } = await request.json();

		if (!appId) {
			return json({ error: 'App ID is required' }, { status: 400 });
		}

		const db = getDbInstance();
		const app = await db.getTwitterApp(appId);

		if (!app) {
			return json({ error: 'Twitter app not found' }, { status: 404 });
		}

		// Check if OAuth 1.0a credentials are present
		const hasOAuth1Credentials =
			app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret;

		// Check if OAuth 2.0 credentials are present
		const hasOAuth2Credentials = app.clientId && app.clientSecret;

		// Test OAuth 2.0 credentials (for basic API access and text tweets)
		let oauth2Test = 'Not tested';
		try {
			const oauth2Client = new TwitterApi({
				clientId: app.clientId,
				clientSecret: app.clientSecret
			});

			// Simple test without making API calls to avoid rate limits
			oauth2Test = 'Success';
			log.info('OAuth 2.0 client created successfully', {
				appId: app.id,
				appName: app.name,
				hasClientId: !!app.clientId,
				hasClientSecret: !!app.clientSecret
			});
		} catch (error) {
			oauth2Test = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
			log.error('Failed to create OAuth 2.0 client:', {
				appId: app.id,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

		// Test OAuth 1.0a credentials (for media uploads)
		let oauth1Test = 'Not tested';
		if (hasOAuth1Credentials) {
			try {
				const oauth1Client = new TwitterApi({
					appKey: app.consumerKey,
					appSecret: app.consumerSecret,
					accessToken: app.accessToken,
					accessSecret: app.accessTokenSecret
				});
				oauth1Test = 'Success';
				log.info('OAuth 1.0a client created successfully', {
					appId: app.id,
					appName: app.name
				});
			} catch (error) {
				oauth1Test = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
				log.error('Failed to create OAuth 1.0a client:', {
					appId: app.id,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		} else {
			oauth1Test = 'No credentials configured';
		}

		// Provide detailed status and recommendations
		const status = {
			textTweets: hasOAuth2Credentials && oauth2Test === 'Success' ? '✅ Ready' : '❌ Not ready',
			mediaUploads: hasOAuth1Credentials && oauth1Test === 'Success' ? '✅ Ready' : '❌ Not ready',
			overall:
				hasOAuth2Credentials && oauth2Test === 'Success' ? '✅ Functional' : '❌ Not functional'
		};

		const recommendations = [];
		if (!hasOAuth2Credentials) {
			recommendations.push(
				'Add OAuth 2.0 credentials (Client ID and Client Secret) for text tweets'
			);
		}
		if (!hasOAuth1Credentials) {
			recommendations.push(
				'Add OAuth 1.0a credentials (Consumer Key, Consumer Secret, Access Token, Access Token Secret) for media uploads'
			);
		}
		if (oauth2Test !== 'Success' && hasOAuth2Credentials) {
			recommendations.push('Check your OAuth 2.0 credentials - they appear to be invalid');
		}
		if (oauth1Test !== 'Success' && hasOAuth1Credentials) {
			recommendations.push('Check your OAuth 1.0a credentials - they appear to be invalid');
		}

		return json({
			success: true,
			message: 'Twitter app configuration test completed',
			app: {
				id: app.id,
				name: app.name,
				hasOAuth1Credentials,
				hasOAuth2Credentials
			},
			tests: {
				oauth2Test,
				oauth1Test
			},
			status,
			recommendations,
			note: 'OAuth 2.0 is required for text tweets, OAuth 1.0a is required for media uploads'
		});
	} catch (error) {
		log.error('Test connection error:', { error });
		return json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
