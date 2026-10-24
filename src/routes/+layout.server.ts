import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	theme: locals.theme,
	sidebarCollapsed: locals.sidebarCollapsed,
	user: locals.user ?? null
});
