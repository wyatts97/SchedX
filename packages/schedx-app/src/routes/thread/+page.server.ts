import type { PageServerLoad } from './$types';
import { getDbInstance } from '$lib/server/db';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession) {
		throw redirect(303, '/login');
	}

	const db = getDbInstance();
	const session = await db.getSession(adminSession);

	if (!session) {
		throw redirect(303, '/login');
	}

	// Fetch connected Twitter accounts
	const accounts = await db.getAccounts('admin');

	return {
		accounts: accounts || [],
		isAuthenticated: true
	};
};
