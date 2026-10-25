import { listAttention, listUpcoming, counts } from '#lib/server/posts/service.js';
import { getHeartbeat, schedulerRunning } from '#lib/server/scheduler/loop.js';
import type { PageServerLoad } from './$types';

// API spend comes from the (app) layout, which every page shares.
export const load: PageServerLoad = ({ depends }) => {
	depends('app:status');
	return {
		upcoming: listUpcoming(8),
		attention: listAttention(),
		counts: counts(),
		scheduler: { running: schedulerRunning(), heartbeat: getHeartbeat() }
	};
};
