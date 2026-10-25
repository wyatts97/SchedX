import { asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { addCalendar } from '../../shared/time.js';
import type { RecurFreq } from '../../shared/types.js';

type PostRow = typeof schema.posts.$inferSelect;

const UNIT: Record<RecurFreq, 'days' | 'weeks' | 'months'> = {
	daily: 'days',
	weekly: 'weeks',
	monthly: 'months'
};

/**
 * The next occurrence strictly after `now`, keeping the same local wall-clock time across
 * DST changes. Returns null when the series has ended.
 */
export function nextOccurrence(
	from: number,
	freq: RecurFreq,
	interval: number,
	until: number | null,
	tz: string,
	now = Date.now()
): number | null {
	const step = Math.max(1, interval);
	let next = addCalendar(from, tz, UNIT[freq], step);
	for (let guard = 0; next <= now && guard < 10_000; guard++) {
		next = addCalendar(next, tz, UNIT[freq], step);
	}
	if (until !== null && next > until) return null;
	return next;
}

/** Clones a recurring post as the next scheduled occurrence. Returns the new post id. */
export function spawnNextOccurrence(post: PostRow, tz: string): string | null {
	if (!post.recurFreq || post.scheduledAt === null) return null;
	const at = nextOccurrence(
		post.scheduledAt,
		post.recurFreq,
		post.recurInterval,
		post.recurUntil,
		tz
	);
	if (at === null) return null;

	const db = getDb();
	return db.transaction((tx) => {
		const items = tx
			.select()
			.from(schema.postItems)
			.where(eq(schema.postItems.postId, post.id))
			.orderBy(asc(schema.postItems.position))
			.all();
		const links = items.length
			? tx
					.select()
					.from(schema.postItemMedia)
					.where(
						inArray(
							schema.postItemMedia.itemId,
							items.map((i) => i.id)
						)
					)
					.all()
			: [];

		const newId = crypto.randomUUID();
		tx.insert(schema.posts)
			.values({
				id: newId,
				accountId: post.accountId,
				status: 'scheduled',
				scheduledAt: at,
				queued: false,
				options: post.options,
				recurFreq: post.recurFreq,
				recurInterval: post.recurInterval,
				recurUntil: post.recurUntil,
				seriesId: post.seriesId ?? post.id
			})
			.run();
		for (const item of items) {
			const itemId = crypto.randomUUID();
			tx.insert(schema.postItems)
				.values({
					id: itemId,
					postId: newId,
					position: item.position,
					text: item.text,
					poll: item.poll
				})
				.run();
			const own = links.filter((l) => l.itemId === item.id);
			if (own.length) {
				tx.insert(schema.postItemMedia)
					.values(
						own.map((l) => ({
							itemId,
							mediaId: l.mediaId,
							position: l.position,
							altText: l.altText
						}))
					)
					.run();
			}
		}
		// Only the newest occurrence carries the series forward.
		tx.update(schema.posts).set({ recurFreq: null }).where(eq(schema.posts.id, post.id)).run();
		return newId;
	});
}
