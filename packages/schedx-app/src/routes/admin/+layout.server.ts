import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const parent = await event.parent();
	return {
		isAuthenticated: (parent as any).isAuthenticated || false,
		isAdmin: (parent as any).isAdmin || false
	};
};
