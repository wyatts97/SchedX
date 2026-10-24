import { listAccounts } from '#lib/server/x/accounts.js';
import { counts } from '#lib/server/posts/service.js';
import { getSettings } from '#lib/server/settings.js';
import { rt } from '#lib/server/runtime.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const c = counts();
	const settings = getSettings();
	return {
		accounts: listAccounts(),
		tz: locals.user?.timezone ?? 'UTC',
		mockMode: rt().xMode === 'mock',
		paused: settings.publishingPaused,
		rates: settings.rates,
		attention: (c.failed ?? 0) + (c.paused ?? 0) + (c.missed ?? 0) + (c.needs_verification ?? 0)
	};
};
