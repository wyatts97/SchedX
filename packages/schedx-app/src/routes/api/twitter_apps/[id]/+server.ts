import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { TwitterApp } from '@schedx/shared-lib/types/types';
import { log } from '$lib/server/logger';
import { TwitterAuthService } from '$lib/server/twitterAuth';
import logger from '$lib/logger';

const twitterAuth = TwitterAuthService.getInstance();

export const PUT: RequestHandler = async ({ params, cookies, request }) => {
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

		const data = await request.json();
		logger.debug('PUT [id] endpoint received data:', data);
		logger.debug('OAuth 1.0a credentials being saved:', {
			consumerKey: data.consumerKey ? `Length: ${data.consumerKey.length}` : 'NOT SET',
			consumerSecret: data.consumerSecret ? `Length: ${data.consumerSecret.length}` : 'NOT SET',
			accessToken: data.accessToken ? `Length: ${data.accessToken.length}` : 'NOT SET',
			accessTokenSecret: data.accessTokenSecret
				? `Length: ${data.accessTokenSecret.length}`
				: 'NOT SET'
		});

		// Validate required fields
		if (!data.name?.trim()) {
			return new Response(JSON.stringify({ error: 'App name is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!data.clientId?.trim()) {
			return new Response(JSON.stringify({ error: 'Client ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!data.clientSecret?.trim()) {
			return new Response(JSON.stringify({ error: 'Client Secret is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!data.callbackUrl?.trim()) {
			return new Response(JSON.stringify({ error: 'Callback URL is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Validate callback URL format
		try {
			const url = new URL(data.callbackUrl);
			if (!url.protocol.startsWith('http')) {
				return new Response(
					JSON.stringify({ error: 'Callback URL must use HTTP or HTTPS protocol' }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid callback URL format' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const updates: Partial<TwitterApp> = {
			name: data.name.trim(),
			clientId: data.clientId.trim(),
			clientSecret: data.clientSecret.trim(),
			consumerKey: data.consumerKey?.trim() || '', // Don't fallback - keep separate
			consumerSecret: data.consumerSecret?.trim() || '', // Don't fallback - keep separate
			accessToken: data.accessToken?.trim() || '',
			accessTokenSecret: data.accessTokenSecret?.trim() || '',
			callbackUrl: data.callbackUrl.trim(),
			updatedAt: new Date()
		};

		logger.debug('PUT [id] endpoint updates object:', updates);

		// Validate app configuration
		try {
			twitterAuth.validateAppConfig(updates as TwitterApp);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return new Response(JSON.stringify({ error: `Invalid app configuration: ${errorMessage}` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		await db.updateTwitterApp(appId, updates);

		log.info('Twitter app updated successfully', { appId, appName: updates.name });

		return new Response(
			JSON.stringify({
				message: 'Twitter app updated successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error updating Twitter app:', { error, appId: params.id });
		return new Response(JSON.stringify({ error: 'Failed to update app' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
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

		// Check if app exists
		const app = await db.getTwitterApp(appId);
		if (!app) {
			return new Response(JSON.stringify({ error: 'Twitter app not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Check if any accounts are using this app
		const accounts = await (db as any).getAllUserAccounts();
		const accountsUsingApp = accounts.filter((acc: any) => acc.twitterAppId === appId);

		if (accountsUsingApp.length > 0) {
			return new Response(
				JSON.stringify({
					error: `Cannot delete app: ${accountsUsingApp.length} account(s) are using this app. Please disconnect accounts first.`
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Delete the app using the database client
		const dbClient = db as any;
		await dbClient.deleteTwitterApp(appId);

		log.info('Twitter app deleted successfully', { appId, appName: app.name });

		return new Response(
			JSON.stringify({
				message: 'Twitter app deleted successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error deleting Twitter app:', { error, appId: params.id });
		return new Response(JSON.stringify({ error: 'Failed to delete app' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const GET: RequestHandler = async ({ params, cookies }) => {
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

		// Return app data with actual credential values for editing
		const appData = {
			id: app.id,
			name: app.name,
			clientId: app.clientId,
			clientSecret: app.clientSecret,
			consumerKey: app.consumerKey,
			consumerSecret: app.consumerSecret,
			accessToken: app.accessToken,
			accessTokenSecret: app.accessTokenSecret,
			callbackUrl: app.callbackUrl,
			createdAt: app.createdAt,
			updatedAt: app.updatedAt
		};

		return new Response(JSON.stringify({ app: appData }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		log.error('Error fetching Twitter app:', { error });
		return new Response(JSON.stringify({ error: 'Failed to fetch app' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
