import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession || adminSession.trim() === '') {
			log.info('Accounts API - No admin session found');
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();

		// Verify admin user exists
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			log.info('Accounts API - Admin user not found');
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		log.info('Fetching all user accounts');
		const accounts = await (db as any).getAllUserAccounts();
		log.info(`Accounts API - Found ${accounts.length} accounts in database`);

		// Transform accounts to include additional info
		const transformedAccounts = await Promise.all(
			accounts.map(async (account: any) => {
				// Get Twitter app info
				let twitterAppName = 'Unknown App';
				let twitterAppId = null;

				if (account.twitterAppId) {
					const app = await db.getTwitterApp(account.twitterAppId);
					if (app) {
						twitterAppId = app.id;
						twitterAppName = app.name;
					}
				}

				return {
					id: account.id, // Use database ID as the primary id for frontend
					userId: account.userId,
					username: account.username,
					provider: account.provider,
					providerAccountId: account.providerAccountId,
					twitterAppId,
					twitterAppName,
					displayName: account.displayName || account.username,
					profileImage: account.profileImage,
					isDefault: account.isDefault || false,
					createdAt: account.createdAt,
					updatedAt: account.updatedAt
					// Don't include sensitive token information
				};
			})
		);

		log.info(`Successfully fetched ${transformedAccounts.length} accounts`);

		// Add cache control headers to prevent stale data
		return new Response(JSON.stringify({ accounts: transformedAccounts }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
				Expires: '0'
			}
		});
	} catch (error) {
		log.error('Error fetching accounts:', { error });
		return new Response(JSON.stringify({ error: 'Failed to fetch accounts' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
	try {
		// Validate admin session
		const adminSession = cookies.get('admin_session');
		if (!adminSession || adminSession.trim() === '') {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();

		// Verify admin user exists
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const { accountId } = await request.json();

		if (!accountId) {
			return new Response(JSON.stringify({ error: 'Account ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get account info before deletion for logging
		const accounts = await (db as any).getAllUserAccounts();
		const accountToDelete = accounts.find((acc: any) => acc.providerAccountId === accountId);

		if (!accountToDelete) {
			return new Response(JSON.stringify({ error: 'Account not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Delete the account using the database _id
		await db.deleteUserAccount(accountToDelete.id);

		log.info('Account deleted successfully', {
			accountId,
			username: accountToDelete.username,
			provider: accountToDelete.provider
		});

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Account disconnected successfully'
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error deleting account:', { error });
		return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
