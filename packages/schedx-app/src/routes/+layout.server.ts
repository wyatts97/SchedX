import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		isAuthenticated: locals.isAuthenticated,
		isAdmin: locals.isAdmin,
		user: locals.user || null
	};
};
