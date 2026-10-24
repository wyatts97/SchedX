import { listAttention, listUpcoming, counts, projectedSpend } from '#lib/server/posts/service.js';
import { currentSpend } from '#lib/server/x/ledger.js';
import { getSettings } from '#lib/server/settings.js';
import { getHeartbeat, schedulerRunning } from '#lib/server/scheduler/loop.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { cycle, spent } = currentSpend();
	return {
		upcoming: listUpcoming(8),
		attention: listAttention(),
		counts: counts(),
		spend: {
			spent,
			projected: projectedSpend(cycle.end),
			budget: getSettings().budget.monthlyUsd,
			cycleStart: cycle.start,
			cycleEnd: cycle.end
		},
		scheduler: { running: schedulerRunning(), heartbeat: getHeartbeat() }
	};
};
