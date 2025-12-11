import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RettiwtService } from '$lib/server/rettiwtService';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

/**
 * POST /api/accounts/refresh-avatars
 * Refresh profile images for all accounts using Rettiwt API (higher quality)
 */
export const POST: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDbInstance();

		// Get all accounts for the user
		const accounts = await db.getUserAccounts(user.id);

		if (!accounts || accounts.length === 0) {
			return json({
				success: true,
				updated: 0,
				message: 'No accounts to update'
			});
		}

		logger.info({ userId: user.id, accountCount: accounts.length }, 'Starting avatar refresh for all accounts');

		const results: { accountId: string; username: string; success: boolean; error?: string }[] = [];

		// Process each account with a small delay to avoid rate limiting
		for (const account of accounts) {
			if (!account.username) {
				results.push({
					accountId: account.id || 'unknown',
					username: 'unknown',
					success: false,
					error: 'No username'
				});
				continue;
			}

			try {
				// Fetch high-quality profile image from Rettiwt
				const profileData = await RettiwtService.getHighQualityProfileImage(account.username, user.id);

				// Update the account in database
				await db.updateAccountProfileImage(account.id!, profileData.profileImage, profileData.displayName);

				results.push({
					accountId: account.id || 'unknown',
					username: account.username || 'unknown',
					success: true
				});

				logger.debug({ accountId: account.id, username: account.username }, 'Avatar refreshed');

				// Small delay between requests to be nice to the API
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (err: any) {
				logger.warn({ error: err?.message, accountId: account.id, username: account.username }, 'Failed to refresh avatar for account');
				results.push({
					accountId: account.id || 'unknown',
					username: account.username || 'unknown',
					success: false,
					error: err?.message || 'Unknown error'
				});
			}
		}

		const successCount = results.filter(r => r.success).length;

		logger.info({ 
			userId: user.id, 
			total: accounts.length,
			success: successCount,
			failed: accounts.length - successCount
		}, 'Avatar refresh completed');

		return json({
			success: true,
			updated: successCount,
			total: accounts.length,
			results
		});
	} catch (err: any) {
		logger.error({ 
			error: {
				message: err?.message,
				stack: err?.stack,
				name: err?.name
			}, 
			userId: user.id 
		}, 'Failed to refresh account avatars');
		throw error(500, 'Failed to refresh account avatars');
	}
};
