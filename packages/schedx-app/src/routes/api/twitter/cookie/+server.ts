import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import { CookieEncryption } from '$lib/server/cookieEncryption';
import { RettiwtService } from '$lib/server/rettiwtService';
import logger from '$lib/server/logger';

/**
 * GET /api/twitter/cookie
 * Check if user has a Rettiwt API key configured
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDbInstance();
		
		// Check if any of the user's Twitter accounts have an API key
		const account = (db as any)['db'].queryOne(
			'SELECT rettiwt_api_key FROM accounts WHERE userId = ? AND provider = ? AND rettiwt_api_key IS NOT NULL LIMIT 1',
			[user.id, 'twitter']
		);

		return json({
			hasCookie: !!account?.rettiwt_api_key,
			configured: !!account?.rettiwt_api_key
		});
	} catch (err) {
		logger.error({ error: err, userId: user.id }, 'Failed to check Rettiwt API key status');
		throw error(500, 'Failed to check API key status');
	}
};

/**
 * POST /api/twitter/cookie
 * Save or update user's Rettiwt API key
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { cookie } = await request.json();

		if (!cookie || typeof cookie !== 'string') {
			throw error(400, 'Rettiwt API key is required');
		}

		// Validate the API key by testing it
		logger.debug({ userId: user.id }, 'Testing Rettiwt API key validity');
		const isValid = await RettiwtService.testApiKey(cookie);

		if (!isValid) {
			throw error(400, 'Invalid Rettiwt API key - authentication failed');
		}

		// Encrypt the API key before storing
		const encryptedApiKey = CookieEncryption.encrypt(cookie);

		// Store in database - update all Twitter accounts for this user
		const db = getDbInstance();
		(db as any)['db'].execute(
			'UPDATE accounts SET rettiwt_api_key = ?, updatedAt = ? WHERE userId = ? AND provider = ?',
			[encryptedApiKey, Date.now(), user.id, 'twitter']
		);

		logger.info({ userId: user.id }, 'Rettiwt API key saved successfully');

		return json({
			success: true,
			message: 'Rettiwt API key saved successfully'
		});
	} catch (err: any) {
		if (err.status) {
			throw err;
		}
		logger.error({ error: err, userId: user.id }, 'Failed to save Rettiwt API key');
		throw error(500, 'Failed to save API key');
	}
};

/**
 * DELETE /api/twitter/cookie
 * Remove user's Rettiwt API key
 */
export const DELETE: RequestHandler = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDbInstance();
		// Remove API key from all Twitter accounts for this user
		(db as any)['db'].execute(
			'UPDATE accounts SET rettiwt_api_key = NULL, updatedAt = ? WHERE userId = ? AND provider = ?',
			[Date.now(), user.id, 'twitter']
		);

		logger.info({ userId: user.id }, 'Rettiwt API key removed successfully');

		return json({
			success: true,
			message: 'Rettiwt API key removed successfully'
		});
	} catch (err) {
		logger.error({ error: err, userId: user.id }, 'Failed to remove Rettiwt API key');
		throw error(500, 'Failed to remove API key');
	}
};
