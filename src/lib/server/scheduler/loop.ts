import fsp from 'node:fs/promises';
import path from 'node:path';
import { Cron } from 'croner';
import { and, asc, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { notInPast } from '../db/helpers.js';
import { dataPath } from '../runtime.js';
import { getSettings, getRaw, setRaw } from '../settings.js';
import { purgeExpiredSessions } from '../auth/index.js';
import { logger, errorMessage } from '../logger.js';
import { notify } from '../notify/index.js';
import { claimPost, publishPost, verifyPost } from './publish.js';
import { MINUTE } from '../../shared/time.js';

const BATCH = 20;
const KEEP_BACKUPS = 7;

interface SchedulerState {
	jobs: Cron[];
	running: boolean;
	rerun: boolean;
}

const g = globalThis as typeof globalThis & { __schedxScheduler?: SchedulerState };

export interface Heartbeat {
	lastTick: number;
	lastPublished?: number;
}

export function getHeartbeat(): Heartbeat | null {
	return (getRaw('scheduler.heartbeat') as Heartbeat | undefined) ?? null;
}

/** One scheduler pass. Exported for tests; production code goes through `kickScheduler`. */
export async function tick(now = Date.now()): Promise<void> {
	const db = getDb();
	setRaw('scheduler.heartbeat', { ...(getHeartbeat() ?? {}), lastTick: now });

	// 1. Publishing that outlived its lease means the process stopped mid-publish.
	db.update(schema.posts)
		.set({
			status: 'needs_verification',
			errorKind: 'ambiguous',
			lastError: 'Interrupted while publishing (server restart?). Checking X before retrying.',
			nextAttemptAt: null,
			leaseUntil: null,
			updatedAt: now
		})
		.where(and(eq(schema.posts.status, 'publishing'), lt(schema.posts.leaseUntil, now)))
		.run();

	// 2. First attempts that are older than the catch-up window were missed (server was down).
	const cutoff = now - getSettings().catchUpMinutes * MINUTE;
	const missed = db
		.update(schema.posts)
		.set({
			status: 'missed',
			lastError: 'The server was not running at the scheduled time.',
			updatedAt: now
		})
		.where(
			and(
				eq(schema.posts.status, 'scheduled'),
				eq(schema.posts.attempts, 0),
				isNull(schema.posts.nextAttemptAt),
				lt(schema.posts.scheduledAt, cutoff)
			)
		)
		.returning({ id: schema.posts.id })
		.all();
	if (missed.length) {
		await notify({
			event: 'missed',
			title: `${missed.length} post${missed.length > 1 ? 's' : ''} missed`,
			body: 'They were due while SchedX was offline. Review them on the dashboard.',
			url: '/'
		});
	}

	if (getSettings().publishingPaused) return;

	// 3. Resolve posts whose outcome is unknown before publishing anything new.
	const toVerify = db
		.select({ id: schema.posts.id })
		.from(schema.posts)
		.where(
			and(
				eq(schema.posts.status, 'needs_verification'),
				or(isNull(schema.posts.nextAttemptAt), lte(schema.posts.nextAttemptAt, now))
			)
		)
		.limit(BATCH)
		.all();
	for (const { id } of toVerify) await verifyPost(id);

	// 4. Publish everything that is due, oldest first, one at a time.
	const due = db
		.select({ id: schema.posts.id })
		.from(schema.posts)
		.where(
			and(
				eq(schema.posts.status, 'scheduled'),
				lte(schema.posts.scheduledAt, now),
				or(isNull(schema.posts.nextAttemptAt), lte(schema.posts.nextAttemptAt, now))
			)
		)
		.orderBy(asc(schema.posts.scheduledAt))
		.limit(BATCH)
		.all();
	for (const { id } of due) {
		if (getSettings().publishingPaused) break;
		if (!claimPost(id, Date.now())) continue;
		try {
			await publishPost(id);
			setRaw('scheduler.heartbeat', { ...(getHeartbeat() ?? { lastTick: now }), lastPublished: Date.now() });
		} catch (err) {
			// publishPost handles its own errors; this is a last-resort guard.
			logger.error({ postId: id, err: errorMessage(err) }, 'unexpected publish error');
		}
	}
}

/** Runs a tick now, or right after the current one finishes. Never overlaps. */
export function kickScheduler(): void {
	const state = g.__schedxScheduler;
	if (!state) return;
	if (state.running) {
		state.rerun = true;
		return;
	}
	state.running = true;
	void (async () => {
		try {
			do {
				state.rerun = false;
				await tick();
			} while (state.rerun);
		} catch (err) {
			logger.error({ err: errorMessage(err) }, 'scheduler tick failed');
		} finally {
			state.running = false;
		}
	})();
}

export async function backupDatabase(): Promise<string> {
	const dir = dataPath('backups');
	await fsp.mkdir(dir, { recursive: true });
	const file = path.join(dir, `schedx-${new Date().toISOString().slice(0, 10)}.db`);
	await getDb().$client.backup(file);
	const files = (await fsp.readdir(dir)).filter((f) => /^schedx-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
	for (const old of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
		await fsp.rm(path.join(dir, old), { force: true });
	}
	return file;
}

export async function listBackups(): Promise<{ name: string; size: number; mtime: number }[]> {
	const dir = dataPath('backups');
	try {
		const names = (await fsp.readdir(dir)).filter((f) => f.endsWith('.db')).sort().reverse();
		return Promise.all(
			names.map(async (name) => {
				const st = await fsp.stat(path.join(dir, name));
				return { name, size: st.size, mtime: st.mtimeMs };
			})
		);
	} catch {
		return [];
	}
}

function purge(): void {
	const sessions = purgeExpiredSessions();
	getDb().delete(schema.oauthStates).where(lt(schema.oauthStates.expiresAt, Date.now())).run();
	if (sessions) logger.debug({ sessions }, 'purged expired sessions');
}

export function startScheduler(): void {
	if (g.__schedxScheduler) {
		// Dev HMR re-runs `init`; keep the existing jobs.
		kickScheduler();
		return;
	}
	const state: SchedulerState = { jobs: [], running: false, rerun: false };
	g.__schedxScheduler = state;
	state.jobs.push(
		new Cron('*/30 * * * * *', { protect: true, name: 'publish' }, () => kickScheduler()),
		new Cron('0 * * * *', { name: 'purge' }, purge),
		new Cron('30 3 * * *', { name: 'backup' }, async () => {
			try {
				await backupDatabase();
			} catch (err) {
				logger.error({ err: errorMessage(err) }, 'backup failed');
			}
		})
	);
	logger.info('scheduler started');
	kickScheduler();
}

export function stopScheduler(): void {
	const state = g.__schedxScheduler;
	if (!state) return;
	for (const job of state.jobs) job.stop();
	g.__schedxScheduler = undefined;
}

export function schedulerRunning(): boolean {
	return !!g.__schedxScheduler;
}

/** Clears a credits/manual pause and re-queues the posts it paused. */
export function resumePublishing(): number {
	setRaw('publishingPaused', null);
	const n = getDb()
		.update(schema.posts)
		.set({
			status: 'scheduled',
			scheduledAt: notInPast(),
			errorKind: null,
			lastError: null,
			nextAttemptAt: null,
			updatedAt: Date.now()
		})
		.where(and(eq(schema.posts.status, 'paused'), inArray(schema.posts.errorKind, ['credits', 'budget'])))
		.run().changes;
	kickScheduler();
	return n;
}
