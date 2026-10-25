import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '#lib/server/db/index.js';
import { savePost, retryNow, findDuplicates } from '#lib/server/posts/service.js';
import { tick, resumePublishing } from '#lib/server/scheduler/loop.js';
import {
	setSlots,
	nextFreeSlot,
	openSlots,
	listQueuedIds,
	reorderQueue
} from '#lib/server/scheduler/queue.js';
import { nextOccurrence } from '#lib/server/scheduler/recurrence.js';
import { mockStore } from '#lib/server/x/mock.js';
import { getSettings, setSetting, DEFAULT_SETTINGS } from '#lib/server/settings.js';
import { currentSpend } from '#lib/server/x/ledger.js';
import { fromLocal, MINUTE } from '#lib/shared/time.js';
import { setupTestEnv, makeImage, postRow, itemRows, TZ } from './helpers.js';
import type { ComposeInput } from '#lib/shared/compose.js';

let accountId: string;

function compose(overrides: Partial<ComposeInput> = {}): string {
	return savePost({
		accountIds: [accountId],
		items: [{ text: 'Hello from SchedX', media: [] }],
		options: {},
		action: 'now',
		...overrides
	})[0];
}

function timeline() {
	return mockStore.posts.get('x-user-1') ?? [];
}

beforeEach(async () => {
	({
		account: { id: accountId }
	} = await setupTestEnv());
});

describe('publishing', () => {
	it('publishes a due post exactly once and records its cost', async () => {
		const id = compose();
		await tick();
		await tick();
		expect(postRow(id).status).toBe('published');
		expect(itemRows(id)[0].xPostId).toBeTruthy();
		expect(timeline()).toHaveLength(1);
		expect(currentSpend().spent).toBeCloseTo(0.015);
	});

	it('posts a thread as a reply chain', async () => {
		const id = compose({
			items: [
				{ text: 'Thread 1/3', media: [] },
				{ text: 'Thread 2/3', media: [] },
				{ text: 'Thread 3/3', media: [] }
			]
		});
		await tick();
		const items = itemRows(id);
		expect(postRow(id).status).toBe('published');
		expect(items.every((i) => i.xPostId)).toBe(true);
		expect(
			timeline()
				.map((t) => t.text)
				.reverse()
		).toEqual(['Thread 1/3', 'Thread 2/3', 'Thread 3/3']);
	});

	it('uploads media and charges for alt text', async () => {
		const mediaId = await makeImage();
		const id = compose({
			items: [{ text: 'pic', media: [{ id: mediaId, altText: 'A blue square' }] }]
		});
		await tick();
		expect(postRow(id).status).toBe('published');
		expect(currentSpend().spent).toBeCloseTo(0.02);
	});

	it('does not publish future posts', async () => {
		const id = compose({ action: 'schedule', scheduledAt: Date.now() + 60 * MINUTE });
		await tick();
		expect(postRow(id).status).toBe('scheduled');
	});
});

describe('failures', () => {
	it('backs off on transient errors instead of retrying every tick', async () => {
		const id = compose({ items: [{ text: 'flaky [fail:transient]', media: [] }] });
		await tick();
		const p = postRow(id);
		expect(p.status).toBe('scheduled');
		expect(p.attempts).toBe(1);
		expect(p.nextAttemptAt).toBeGreaterThan(Date.now() + 30_000);
		await tick();
		expect(postRow(id).attempts).toBe(1); // not retried before nextAttemptAt
	});

	it('fails duplicates permanently without retrying', async () => {
		const id = compose({ items: [{ text: 'dupe [fail:duplicate]', media: [] }] });
		await tick();
		expect(postRow(id).status).toBe('failed');
		expect(postRow(id).errorKind).toBe('duplicate');
	});

	it('verifies an ambiguous failure instead of posting twice', async () => {
		const id = compose({ items: [{ text: 'maybe posted [fail:ambiguous]', media: [] }] });
		await tick();
		expect(postRow(id).status).toBe('needs_verification');
		expect(timeline()).toHaveLength(1); // the mock accepted it before "failing"

		// Verification runs once nextAttemptAt has passed.
		await tick(Date.now() + 2 * MINUTE);
		expect(postRow(id).status).toBe('published');
		expect(timeline()).toHaveLength(1);
	});

	it('resumes a thread from the first unposted item after a failure', async () => {
		const id = compose({
			items: [
				{ text: 'part one', media: [] },
				{ text: 'part two [fail:transient]', media: [] },
				{ text: 'part three', media: [] }
			]
		});
		await tick();
		expect(itemRows(id).map((i) => !!i.xPostId)).toEqual([true, false, false]);

		// Fix the text (as if the transient issue went away) and let the retry run.
		getDb()
			.update(schema.postItems)
			.set({ text: 'part two' })
			.where(eq(schema.postItems.id, itemRows(id)[1].id))
			.run();
		getDb().update(schema.posts).set({ nextAttemptAt: null }).where(eq(schema.posts.id, id)).run();
		await tick();
		expect(postRow(id).status).toBe('published');
		expect(
			timeline()
				.map((t) => t.text)
				.reverse()
		).toEqual(['part one', 'part two', 'part three']);
	});

	it('recovers a post interrupted mid-publish (expired lease) via verification', async () => {
		const id = compose();
		getDb()
			.update(schema.posts)
			.set({ status: 'publishing', leaseUntil: Date.now() - 1000, attempts: 1 })
			.where(eq(schema.posts.id, id))
			.run();
		await tick();
		// Not on X yet, so it is retried and published once.
		await tick();
		expect(postRow(id).status).toBe('published');
		expect(timeline()).toHaveLength(1);
	});

	it('pauses everything when X reports the account is out of credits', async () => {
		const a = compose({ items: [{ text: 'no money [fail:credits]', media: [] }] });
		const b = compose({ items: [{ text: 'next one', media: [] }] });
		await tick();
		expect(postRow(a).status).toBe('paused');
		expect(getSettings().publishingPaused?.reason).toBe('credits');
		expect(postRow(b).status).toBe('scheduled');

		getDb()
			.update(schema.postItems)
			.set({ text: 'money now' })
			.where(eq(schema.postItems.postId, a))
			.run();
		resumePublishing();
		await tick();
		expect(postRow(a).status).toBe('published');
		expect(postRow(b).status).toBe('published');
	});

	it('pauses a post that would exceed the monthly budget', async () => {
		setSetting('budget', { ...DEFAULT_SETTINGS.budget, monthlyUsd: 0.1 });
		const id = compose({ items: [{ text: 'link https://example.com', media: [] }] }); // $0.20
		await tick();
		expect(postRow(id).status).toBe('paused');
		expect(postRow(id).errorKind).toBe('budget');
		expect(timeline()).toHaveLength(0);
	});

	it('marks posts missed when the server was down past the catch-up window', async () => {
		const id = compose({ action: 'schedule', scheduledAt: Date.now() + MINUTE });
		getDb()
			.update(schema.posts)
			.set({ scheduledAt: Date.now() - 60 * MINUTE })
			.where(eq(schema.posts.id, id))
			.run();
		await tick();
		expect(postRow(id).status).toBe('missed');
		retryNow(id);
		await tick();
		expect(postRow(id).status).toBe('published');
	});
});

describe('queue', () => {
	it('fills the next free slots in the account timezone', () => {
		const after = fromLocal('2026-11-02', 8 * 60, TZ); // Monday 08:00 local
		setSlots(accountId, [
			{ weekday: 1, minutes: 9 * 60 },
			{ weekday: 1, minutes: 17 * 60 }
		]);
		const first = nextFreeSlot(accountId, TZ, after)!;
		expect(first).toBe(fromLocal('2026-11-02', 9 * 60, TZ));
	});

	it('assigns distinct slots and can reorder them', () => {
		setSlots(
			accountId,
			[1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, minutes: 12 * 60 }))
		);
		const a = compose({ action: 'queue', items: [{ text: 'A', media: [] }] });
		const b = compose({ action: 'queue', items: [{ text: 'B', media: [] }] });
		const queued = listQueuedIds(accountId);
		expect(queued.map((q) => q.id)).toEqual([a, b]);
		expect(queued[0].scheduledAt).toBeLessThan(queued[1].scheduledAt);
		reorderQueue(accountId, [b, a]);
		expect(listQueuedIds(accountId).map((q) => q.id)).toEqual([b, a]);
	});

	it('refuses to queue without slots', () => {
		expect(() => compose({ action: 'queue' })).toThrow(/queue times/);
	});

	describe('open slots for the calendar', () => {
		// Friday noon before the US clocks fall back (Sunday 2026-11-01).
		beforeEach(() => {
			vi.useFakeTimers({ toFake: ['Date'] });
			vi.setSystemTime(fromLocal('2026-10-30', 12 * 60, TZ));
		});
		afterEach(() => vi.useRealTimers());

		it('lists future, unused slot times and keeps wall-clock time across DST', () => {
			setSlots(
				accountId,
				[1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [
					{ weekday, minutes: 9 * 60 },
					{ weekday, minutes: 18 * 60 }
				])
			);
			compose({ action: 'schedule', scheduledAt: fromLocal('2026-10-31', 18 * 60, TZ) });

			const slots = openSlots(
				accountId,
				TZ,
				fromLocal('2026-10-30', 0, TZ),
				fromLocal('2026-11-03', 0, TZ)
			);
			const at = (date: string, h: number) => fromLocal(date, h * 60, TZ);
			expect(slots).toEqual([
				at('2026-10-30', 18), // 09:00 Friday is already past
				at('2026-10-31', 9), // 18:00 Saturday is taken
				at('2026-11-01', 9),
				at('2026-11-01', 18),
				at('2026-11-02', 9),
				at('2026-11-02', 18)
			]);
			expect(at('2026-11-01', 9) - at('2026-10-31', 9)).toBe(25 * 60 * MINUTE);
		});

		it('returns nothing without queue times', () => {
			expect(openSlots(accountId, TZ, Date.now(), Date.now() + 7 * 24 * 60 * MINUTE)).toEqual([]);
		});
	});
});

describe('duplicate check', () => {
	it('matches a recent post despite different links, spacing and case', async () => {
		const id = compose({ items: [{ text: 'Big news: https://example.com/a', media: [] }] });
		await tick();
		expect(postRow(id).status).toBe('published');
		const matches = findDuplicates([accountId], ['big   NEWS: https://example.com/other']);
		expect(matches.map((m) => m.postId)).toEqual([id]);
		expect(matches[0].status).toBe('published');
	});

	it('matches pending posts, but not drafts or the post being edited', () => {
		const later = Date.now() + 3 * 24 * 60 * MINUTE;
		const id = compose({
			action: 'schedule',
			scheduledAt: later,
			items: [{ text: 'See you later', media: [] }]
		});
		compose({ action: 'draft', items: [{ text: 'Just a draft', media: [] }] });

		expect(findDuplicates([accountId], ['see you later']).map((m) => m.postId)).toEqual([id]);
		expect(findDuplicates([accountId], ['see you later'], id)).toEqual([]);
		expect(findDuplicates([accountId], ['Just a draft'])).toEqual([]);
		expect(findDuplicates([accountId], [''])).toEqual([]);
	});
});

describe('recurrence', () => {
	it('keeps the wall-clock time across DST', () => {
		const tz = 'America/New_York';
		const before = fromLocal('2026-03-07', 9 * 60, tz);
		const next = nextOccurrence(before, 'daily', 1, null, tz, before);
		expect(next).toBe(fromLocal('2026-03-08', 9 * 60, tz));
	});

	it('schedules the next occurrence after publishing', async () => {
		const at = Date.now() - 1000;
		const id = savePost({
			accountIds: [accountId],
			items: [{ text: 'daily tip', media: [] }],
			options: {},
			action: 'schedule',
			scheduledAt: at,
			recurrence: { freq: 'daily', interval: 1, until: null }
		})[0];
		await tick();
		expect(postRow(id).status).toBe('published');
		const next = getDb()
			.select()
			.from(schema.posts)
			.all()
			.find((p) => p.seriesId === id);
		expect(next?.status).toBe('scheduled');
		expect(next?.scheduledAt).toBeGreaterThan(Date.now());
	});
});
