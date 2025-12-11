import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

// Helper to get user ID from session
async function getUserIdFromSession(adminSession: string): Promise<string | null> {
	const db = getDbInstance();
	const session = await db.getSession(adminSession);
	return session?.data?.user?.id || null;
}

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

		const userId = await getUserIdFromSession(adminSession);
		if (!userId) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const db = getDbInstance();
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
