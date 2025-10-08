import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		throw redirect(303, '/login');
	}

	return {
		// No data needed from server, media is fetched client-side
	};
};
