import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { fromLocal, zoned, MINUTE } from '../../shared/time.js';

export interface Slot {
	weekday: number;
	minutes: number;
}

const LOOKAHEAD_DAYS = 90;

export function getSlots(accountId: string): Slot[] {
	return getDb()
		.select({ weekday: schema.queueSlots.weekday, minutes: schema.queueSlots.minutes })
		.from(schema.queueSlots)
		.where(eq(schema.queueSlots.accountId, accountId))
		.orderBy(asc(schema.queueSlots.weekday), asc(schema.queueSlots.minutes))
		.all();
}

export function setSlots(accountId: string, slots: Slot[]): void {
	const unique = new Map(slots.map((s) => [`${s.weekday}:${s.minutes}`, s]));
	getDb().transaction((tx) => {
		tx.delete(schema.queueSlots).where(eq(schema.queueSlots.accountId, accountId)).run();
		if (unique.size) {
			tx.insert(schema.queueSlots)
				.values([...unique.values()].map((s) => ({ accountId, ...s })))
				.run();
		}
	});
}

function occupiedMinutes(accountId: string, after: number, excludePostId?: string): Set<number> {
	const rows = getDb()
		.select({ id: schema.posts.id, at: schema.posts.scheduledAt })
		.from(schema.posts)
		.where(
			and(
				eq(schema.posts.accountId, accountId),
				inArray(schema.posts.status, ['scheduled', 'publishing', 'paused']),
				gte(schema.posts.scheduledAt, after - MINUTE)
			)
		)
		.all();
	return new Set(
		rows
			.filter((r) => r.id !== excludePostId && r.at !== null)
			.map((r) => Math.floor(r.at! / MINUTE))
	);
}

/**
 * Queue slot times for the account, in order, that are after `after`, no later than `until`
 * and not occupied by another pending post. DST-safe: each slot is a local wall-clock time.
 */
function* freeSlotTimes(
	accountId: string,
	tz: string,
	after: number,
	until: number,
	excludePostId?: string
): Generator<number> {
	const slots = getSlots(accountId);
	if (!slots.length) return;
	const taken = occupiedMinutes(accountId, after, excludePostId);
	const first = zoned(after, tz).toPlainDate();
	for (let date = first; ; date = date.add({ days: 1 })) {
		const dayStart = fromLocal(date.toString(), 0, tz);
		if (dayStart > until) return;
		for (const s of slots) {
			if (s.weekday !== date.dayOfWeek) continue;
			const at = fromLocal(date.toString(), s.minutes, tz);
			if (at <= after + MINUTE || at > until) continue;
			if (taken.has(Math.floor(at / MINUTE))) continue;
			yield at;
		}
	}
}

/**
 * Next queue slot for the account that no other pending post occupies, or null when the
 * account has no queue times configured.
 */
export function nextFreeSlot(
	accountId: string,
	tz: string,
	after = Date.now(),
	excludePostId?: string
): number | null {
	const until = after + LOOKAHEAD_DAYS * 24 * 60 * MINUTE;
	for (const at of freeSlotTimes(accountId, tz, after, until, excludePostId)) return at;
	return null;
}

/** Open (unused, future) queue times for the account between `from` and `to`, for the calendar. */
export function openSlots(accountId: string, tz: string, from: number, to: number): number[] {
	return [...freeSlotTimes(accountId, tz, Math.max(from, Date.now()), to)];
}

export function listQueuedIds(accountId: string): { id: string; scheduledAt: number }[] {
	return getDb()
		.select({ id: schema.posts.id, scheduledAt: schema.posts.scheduledAt })
		.from(schema.posts)
		.where(
			and(
				eq(schema.posts.accountId, accountId),
				eq(schema.posts.queued, true),
				eq(schema.posts.status, 'scheduled')
			)
		)
		.orderBy(asc(schema.posts.scheduledAt))
		.all() as { id: string; scheduledAt: number }[];
}

/** Re-assigns the queue's existing time slots to its posts in the given order. */
export function reorderQueue(accountId: string, orderedIds: string[]): void {
	const current = listQueuedIds(accountId);
	const times = current.map((p) => p.scheduledAt).sort((a, b) => a - b);
	const known = new Set(current.map((p) => p.id));
	const order = orderedIds.filter((id) => known.has(id));
	// Posts missing from the request keep their relative order at the end.
	for (const p of current) if (!order.includes(p.id)) order.push(p.id);
	getDb().transaction((tx) => {
		order.forEach((id, i) => {
			tx.update(schema.posts)
				.set({ scheduledAt: times[i], updatedAt: Date.now() })
				.where(eq(schema.posts.id, id))
				.run();
		});
	});
}

export function shuffleQueue(accountId: string): void {
	const ids = listQueuedIds(accountId).map((p) => p.id);
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	reorderQueue(accountId, ids);
}
