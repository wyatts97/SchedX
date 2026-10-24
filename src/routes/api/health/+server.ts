import { getDb } from '#lib/server/db/index.js';
import { getHeartbeat, schedulerRunning } from '#lib/server/scheduler/loop.js';
import type { RequestHandler } from './$types';

/** Public, minimal health check for Docker / uptime monitors. */
export const GET: RequestHandler = () => {
	try {
		getDb().$client.prepare('select 1').get();
	} catch {
		return Response.json({ ok: false, db: false }, { status: 503 });
	}
	const beat = getHeartbeat();
	const stale = schedulerRunning() && (!beat || Date.now() - beat.lastTick > 5 * 60_000);
	return Response.json(
		{ ok: !stale, db: true, scheduler: schedulerRunning() ? (stale ? 'stale' : 'ok') : 'off' },
		{ status: stale ? 503 : 200, headers: { 'cache-control': 'no-store' } }
	);
};
