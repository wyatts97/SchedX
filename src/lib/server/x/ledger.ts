import { and, gte, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { getSettings } from '../settings.js';
import { round } from '../../shared/cost.js';
import type { Rates } from '../../shared/types.js';

export type BillableOp =
	| 'post.create'
	| 'post.create_url'
	| 'media.metadata'
	| 'user.read'
	| 'post.read.owned';

const RATE_FOR: Record<BillableOp, keyof Rates> = {
	'post.create': 'post',
	'post.create_url': 'postWithUrl',
	'media.metadata': 'mediaMetadata',
	'user.read': 'userRead',
	'post.read.owned': 'ownedRead'
};

export function recordUsage(entry: {
	op: BillableOp;
	units?: number;
	accountId?: string | null;
	postId?: string | null;
}): void {
	const units = entry.units ?? 1;
	if (units <= 0) return;
	const rate = getSettings().rates[RATE_FOR[entry.op]];
	getDb()
		.insert(schema.apiLedger)
		.values({
			op: entry.op,
			units,
			accountId: entry.accountId ?? null,
			postId: entry.postId ?? null,
			costUsd: round(rate * units)
		})
		.run();
}

export interface Cycle {
	start: number;
	end: number;
	key: string;
}

/** The current billing cycle, starting on `cycleDay` of the month (UTC). */
export function billingCycle(cycleDay: number, now = Date.now()): Cycle {
	const d = new Date(now);
	let y = d.getUTCFullYear();
	let m = d.getUTCMonth();
	if (d.getUTCDate() < cycleDay) m -= 1;
	if (m < 0) {
		m = 11;
		y -= 1;
	}
	const start = Date.UTC(y, m, cycleDay);
	const end = Date.UTC(y, m + 1, cycleDay);
	return { start, end, key: new Date(start).toISOString().slice(0, 10) };
}

export function spendBetween(start: number, end: number): number {
	const row = getDb()
		.select({ total: sql<number>`coalesce(sum(${schema.apiLedger.costUsd}), 0)` })
		.from(schema.apiLedger)
		.where(and(gte(schema.apiLedger.ts, start), lt(schema.apiLedger.ts, end)))
		.get();
	return round(row?.total ?? 0);
}

export function currentSpend(): { cycle: Cycle; spent: number } {
	const cycle = billingCycle(getSettings().budget.cycleDay);
	return { cycle, spent: spendBetween(cycle.start, cycle.end) };
}

export function spendByOp(start: number, end: number) {
	return getDb()
		.select({
			op: schema.apiLedger.op,
			units: sql<number>`sum(${schema.apiLedger.units})`,
			cost: sql<number>`sum(${schema.apiLedger.costUsd})`
		})
		.from(schema.apiLedger)
		.where(and(gte(schema.apiLedger.ts, start), lt(schema.apiLedger.ts, end)))
		.groupBy(schema.apiLedger.op)
		.all();
}
