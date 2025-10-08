import type { PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';

export const load: PageServerLoad = async ({ cookies, url }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		throw redirect(303, '/login');
	}

	// Fetch all Twitter accounts (for admin user)
	const db = getDbInstance();
	const accounts = await (db as any).getAllUserAccounts();
	const twitterAccountId = url.searchParams.get('twitterAccountId') || (accounts[0]?.id ?? '');

	try {
		const drafts = await db.getDrafts('admin', twitterAccountId);
		return { drafts, accounts, selectedAccountId: twitterAccountId };
	} catch (error) {
		return fail(500, { error: 'Failed to load drafts.' });
	}
};
