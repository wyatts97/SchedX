import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * POST /api/accounts/:id/refresh-avatar
 * Refresh profile image for a specific account
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	const { id } = params;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	if (!id) {
		throw error(400, 'Account ID is required');
	}

	try {
		const db = getDbInstance();

		// Get the account from database
		const accounts = await db.getUserAccounts(user.id);
		const account = accounts.find((acc) => acc.id === id);

		if (!account) {
			throw error(404, 'Account not found');
		}

		if (!account.username) {
			throw error(400, 'Account has no username');
		}

		logger.debug({ accountId: id, username: account.username }, 'Refreshing account avatar');

		// Note: Rettiwt integration removed - avatar refresh not available
		throw error(501, 'Avatar refresh service not available');
	} catch (err: any) {
		logger.error({ error: err, accountId: id, userId: user.id }, 'Failed to refresh account avatar');
		
		if (err.status) {
			throw err;
		}
		
		throw error(500, 'Failed to refresh account avatar');
	}
};
