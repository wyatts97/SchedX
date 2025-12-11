import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';
import { TwitterApi } from 'twitter-api-v2';
import { TwitterAuthService } from '$lib/server/twitterAuth';

// Helper to get user ID from session
async function getUserIdFromSession(adminSession: string): Promise<string | null> {
	const db = getDbInstance();
	const session = await db.getSession(adminSession);
	return session?.data?.user?.id || null;
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const userId = await getUserIdFromSession(adminSession);
		if (!userId) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
		const appId = url.searchParams.get('appId');
		if (!appId) {
			return new Response(JSON.stringify({ error: 'App ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get the Twitter app
		const twitterApp = await db.getTwitterApp(appId);
		if (!twitterApp) {
			return new Response(JSON.stringify({ error: 'Twitter app not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get user accounts for this app
		const accounts = await (db as any).getAllUserAccounts();
		const appAccounts = accounts.filter((acc: any) => acc.twitterAppId === appId);

		if (appAccounts.length === 0) {
			return new Response(
				JSON.stringify({
					error: 'No connected accounts found for this app',
					app: {
						id: twitterApp.id,
						name: twitterApp.name,
						clientId: twitterApp.clientId ? 'SET' : 'NOT SET',
						clientSecret: twitterApp.clientSecret ? 'SET' : 'NOT SET',
						callbackUrl: twitterApp.callbackUrl
					}
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const account = appAccounts[0];
		const twitterAuth = TwitterAuthService.getInstance();
		const { client: twitterClient } = await twitterAuth.getAuthenticatedClient(account, twitterApp);

		// Test basic API access
		const me = await twitterClient.v2.me();

		// Test if we can get app info (this might fail if app doesn't have right permissions)
		let appInfo = null;
		try {
			// Try to get app info - this will fail if app doesn't have right permissions
			appInfo = await twitterClient.v2.get('https://api.twitter.com/2/apps/me');
		} catch (appError) {
			log.warn('Could not get app info, this is normal for user tokens', {
				error: appError instanceof Error ? appError.message : 'Unknown error'
			});
		}

		return new Response(
			JSON.stringify({
				success: true,
				app: {
					id: twitterApp.id,
					name: twitterApp.name,
					clientId: twitterApp.clientId ? 'SET' : 'NOT SET',
					clientSecret: twitterApp.clientSecret ? 'SET' : 'NOT SET',
					callbackUrl: twitterApp.callbackUrl
				},
				account: {
					id: account.id,
					username: account.username,
					providerAccountId: account.providerAccountId,
					hasAccessToken: !!account.access_token,
					hasRefreshToken: !!account.refresh_token,
					expiresAt: account.expires_at
				},
				apiTest: {
					userId: me.data?.id,
					username: me.data?.username,
					name: me.data?.name,
					canAccessAPI: true
				},
				appInfo: appInfo ? 'Available' : 'Not available (normal for user tokens)'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Twitter app test failed:', {
			error: error instanceof Error ? error.message : 'Unknown error',
			stack: error instanceof Error ? error.stack : undefined
		});

		return new Response(
			JSON.stringify({
				error: 'Twitter app test failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
