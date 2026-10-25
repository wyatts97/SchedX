import { listAccounts } from '#lib/server/x/accounts.js';
import { counts, projectedSpend } from '#lib/server/posts/service.js';
import { currentSpend } from '#lib/server/x/ledger.js';
import { getSettings } from '#lib/server/settings.js';
import { rt } from '#lib/server/runtime.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url, depends }) => {
	// Re-run on every navigation and on the shell's periodic refresh, so the attention badge and
	// the spend meter never go stale.
	void url.pathname;
	depends('app:status');

	const c = counts();
	const settings = getSettings();
	const { cycle, spent } = currentSpend();
	return {
		accounts: listAccounts(),
		tz: locals.user?.timezone ?? 'UTC',
		mockMode: rt().xMode === 'mock',
		paused: settings.publishingPaused,
		rates: settings.rates,
		attention: (c.failed ?? 0) + (c.paused ?? 0) + (c.missed ?? 0) + (c.needs_verification ?? 0),
		spend: {
			spent,
			budget: settings.budget.monthlyUsd,
			projected: projectedSpend(cycle.end),
			cycleEnd: cycle.end
		}
	};
};
