import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { TwitterApp } from '@schedx/shared-lib/types/types';
import logger, { log } from '$lib/server/logger';
import { TwitterAuthService } from '$lib/server/twitterAuth';
import { ObjectId } from 'mongodb';

const twitterAuth = TwitterAuthService.getInstance();

export const GET: RequestHandler = async ({ cookies }) => {
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

		const apps = await db.listTwitterApps();
		log.info('Twitter apps fetched successfully', { count: apps.length });

		return new Response(JSON.stringify({ apps }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		logger.error('Error fetching Twitter apps');
		return new Response(JSON.stringify({ error: 'Failed to fetch apps' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const POST: RequestHandler = async ({ cookies, request }) => {
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

		const data = await request.json();

		logger.debug('POST endpoint received data');
		logger.debug('OAuth 1.0a credentials being saved');

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

		const app: TwitterApp = {
			name: data.name.trim(),
			clientId: data.clientId.trim(),
			clientSecret: data.clientSecret.trim(),
			consumerKey: data.consumerKey?.trim() || '',
			consumerSecret: data.consumerSecret?.trim() || '',
			accessToken: data.accessToken?.trim() || '',
			accessTokenSecret: data.accessTokenSecret?.trim() || '',
			callbackUrl: data.callbackUrl.trim(),
			createdAt: new Date(),
			updatedAt: new Date()
		};

		// Validate app configuration
		try {
			twitterAuth.validateAppConfig(app);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return new Response(JSON.stringify({ error: `Invalid app configuration: ${errorMessage}` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const id = await db.createTwitterApp(app);

		log.info('Twitter app created successfully', { appId: id, appName: app.name });

		return new Response(
			JSON.stringify({
				id,
				message: 'Twitter app created successfully'
			}),
			{
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		logger.error('Error creating Twitter app');
		return new Response(JSON.stringify({ error: 'Failed to create app' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const PUT: RequestHandler = async ({ cookies, request }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	try {
		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		}

		const data = await request.json();
		logger.debug('PUT endpoint received data');

		if (!data.id) {
			return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
		}

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
			consumerKey: data.consumerKey?.trim() || '',
			consumerSecret: data.consumerSecret?.trim() || '',
			accessToken: data.accessToken?.trim() || '',
			accessTokenSecret: data.accessTokenSecret?.trim() || '',
			callbackUrl: data.callbackUrl.trim(),
			updatedAt: new Date()
		};

		logger.debug('PUT endpoint updates object');

		// Validate app configuration
		try {
			const currentApp = await db.getTwitterApp(data.id);
			if (!currentApp) {
				return new Response(JSON.stringify({ error: 'Twitter app not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const updatedApp = { ...currentApp, ...updates };
			logger.debug('PUT endpoint updated app object');
			twitterAuth.validateAppConfig(updatedApp);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return new Response(JSON.stringify({ error: `Invalid app configuration: ${errorMessage}` }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		await db.updateTwitterApp(data.id, updates);

		log.info('Twitter app updated successfully', { appId: data.id, appName: updates.name });

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Twitter app updated successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		logger.error('Error updating Twitter app');
		return new Response(JSON.stringify({ error: 'Failed to update app' }), { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	try {
		const db = getDbInstance();
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		}

		const data = await request.json();
		if (!data.id) {
			return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
		}
		const dbConn = await db.connect();
		await dbConn.collection('twitter_apps').deleteOne({ _id: new ObjectId(data.id) });
		return new Response(JSON.stringify({ success: true }), { status: 200 });
	} catch (error) {
		logger.error('Error deleting Twitter app');
		return new Response(JSON.stringify({ error: 'Failed to delete app' }), { status: 500 });
	}
};
