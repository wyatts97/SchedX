import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

export const POST: RequestHandler = async ({ cookies, request }) => {
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

		// Verify account exists
		const accounts = await (db as any).getAllUserAccounts();
		const targetAccount = accounts.find((acc: any) => acc.providerAccountId === accountId);

		if (!targetAccount) {
			return new Response(JSON.stringify({ error: 'Account not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Clear all default flags first
		await db.clearDefaultAccounts();

		// Set the new default account using the database _id
		await db.setDefaultAccount(targetAccount.id);

		log.info('Default account set successfully', {
			accountId,
			username: targetAccount.username,
			provider: targetAccount.provider
		});

		return new Response(
			JSON.stringify({
				success: true,
				message: 'Default account updated successfully',
				account: {
					id: targetAccount.id,
					username: targetAccount.username,
					displayName: targetAccount.displayName,
					provider: targetAccount.provider
				}
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		log.error('Error setting default account:', { error });
		return new Response(JSON.stringify({ error: 'Failed to set default account' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
