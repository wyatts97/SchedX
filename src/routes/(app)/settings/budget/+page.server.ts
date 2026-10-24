import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { getSettings, setSetting } from '#lib/server/settings.js';
import { currentSpend, spendByOp } from '#lib/server/x/ledger.js';
import { counts, projectedSpend, resumePaused } from '#lib/server/posts/service.js';
import { kickScheduler } from '#lib/server/scheduler/loop.js';
import { DEFAULT_RATES, type Rates } from '#lib/shared/types.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const s = getSettings();
	const { cycle, spent } = currentSpend();
	return {
		budget: s.budget,
		rates: s.rates,
		spent,
		projected: projectedSpend(cycle.end),
		cycle,
		byOp: spendByOp(cycle.start, cycle.end),
		pausedCount: counts().paused ?? 0
	};
};

const money = z.coerce.number().min(0).max(100_000);

export const actions: Actions = {
	budget: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = z
			.object({
				monthlyUsd: money,
				warnPct: z.coerce.number().int().min(1).max(100),
				cycleDay: z.coerce.number().int().min(1).max(28)
			})
			.safeParse(form);
		if (!parsed.success) return fail(400, { error: parsed.error.issues[0].message });
		setSetting('budget', parsed.data);
		setSetting('budgetWarnedCycle', null);
		return { saved: 'budget' };
	},
	rates: async ({ request }) => {
		const form = Object.fromEntries(await request.formData());
		const parsed = z
			.object(
				Object.fromEntries(Object.keys(DEFAULT_RATES).map((k) => [k, money])) as Record<
					keyof Rates,
					typeof money
				>
			)
			.safeParse(form);
		if (!parsed.success) return fail(400, { error: 'Rates must be numbers.' });
		setSetting('rates', parsed.data as Rates);
		return { saved: 'rates' };
	},
	resetRates: async () => {
		setSetting('rates', DEFAULT_RATES);
		return { saved: 'rates' };
	},
	resume: async () => {
		const n = resumePaused(['budget']);
		kickScheduler();
		return { resumed: n };
	}
};
