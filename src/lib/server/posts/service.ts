import { and, asc, desc, eq, gte, inArray, isNotNull, lt, or, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { notInPast } from '../db/helpers.js';
import { getSettings } from '../settings.js';
import { getUser } from '../auth/index.js';
import { toInfo } from '../media/storage.js';
import { nextFreeSlot } from '../scheduler/queue.js';
import { estimateCost } from '../../shared/cost.js';
import { textStats } from '../../shared/text.js';
import { validateAttachmentSet } from '../../shared/media-rules.js';
import type { ComposeInput, PostItemView, PostView } from '../../shared/compose.js';
import type { PostStatus } from '../../shared/types.js';

type PostRow = typeof schema.posts.$inferSelect;

export class ComposeError extends Error {}

const EDITABLE: PostStatus[] = ['draft', 'scheduled', 'failed', 'paused', 'missed'];

function tz(): string {
	return getUser()?.timezone ?? 'UTC';
}

// ---------------------------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------------------------

function validate(input: ComposeInput) {
	const db = getDb();
	const accounts = db
		.select()
		.from(schema.accounts)
		.where(inArray(schema.accounts.id, input.accountIds))
		.all();
	if (accounts.length !== input.accountIds.length)
		throw new ComposeError('Unknown account selected.');
	if (input.id && input.accountIds.length !== 1)
		throw new ComposeError('An existing post belongs to one account.');

	const mediaIds = input.items.flatMap((i) => i.media.map((m) => m.id));
	const mediaRows = mediaIds.length
		? db.select().from(schema.media).where(inArray(schema.media.id, mediaIds)).all()
		: [];
	const kinds = new Map(mediaRows.map((m) => [m.id, m.kind]));

	input.items.forEach((item, idx) => {
		const label = input.items.length > 1 ? `Post ${idx + 1}: ` : '';
		const hasMedia = item.media.length > 0;
		if (!item.text.trim() && !hasMedia)
			throw new ComposeError(`${label}Write something or attach media.`);
		for (const m of item.media) {
			if (!kinds.has(m.id)) throw new ComposeError(`${label}An attached file no longer exists.`);
		}
		const err = validateAttachmentSet(item.media.map((m) => kinds.get(m.id)!));
		if (err) throw new ComposeError(label + err);
		if (item.poll) {
			if (idx !== 0) throw new ComposeError('Only the first post of a thread can have a poll.');
			if (hasMedia) throw new ComposeError('A post cannot have both a poll and media.');
			if (!item.text.trim()) throw new ComposeError('A poll needs question text.');
		}
		for (const a of accounts) {
			const stats = textStats(item.text, a.premium);
			if (stats.over) {
				throw new ComposeError(
					`${label}Too long for @${a.username} (${stats.weighted}/${stats.limit}).` +
						(a.premium ? '' : ' Mark the account as Premium to allow long posts.')
				);
			}
		}
	});

	if (input.action === 'schedule') {
		if (!input.scheduledAt) throw new ComposeError('Pick a date and time.');
		if (input.scheduledAt < Date.now() - 60_000)
			throw new ComposeError('That time is in the past.');
	}
	return { accounts };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

function writeItems(tx: Tx, postId: string, input: ComposeInput) {
	input.items.forEach((item, position) => {
		const itemId = crypto.randomUUID();
		tx.insert(schema.postItems)
			.values({
				id: itemId,
				postId,
				position,
				text: item.text,
				poll: position === 0 ? (item.poll ?? null) : null
			})
			.run();
		if (item.media.length) {
			tx.insert(schema.postItemMedia)
				.values(
					item.media.map((m, i) => ({
						itemId,
						mediaId: m.id,
						position: i,
						altText: m.altText ?? ''
					}))
				)
				.run();
		}
	});
}

/** Saves composer input. Returns the ids of the created/updated posts. */
export function savePost(input: ComposeInput): string[] {
	validate(input);
	const db = getDb();
	const now = Date.now();
	const ids: string[] = [];

	for (const accountId of input.accountIds) {
		let scheduledAt: number | null = null;
		let queued = false;
		let status: PostStatus = 'scheduled';
		switch (input.action) {
			case 'draft':
				status = 'draft';
				scheduledAt = input.scheduledAt ?? null;
				break;
			case 'now':
				scheduledAt = now;
				break;
			case 'schedule':
				scheduledAt = input.scheduledAt!;
				break;
			case 'queue': {
				const slot = nextFreeSlot(accountId, tz(), now, input.id);
				if (slot === null) {
					throw new ComposeError(
						'This account has no queue times yet. Add some on the Queue page.'
					);
				}
				scheduledAt = slot;
				queued = true;
				break;
			}
		}

		const values = {
			accountId,
			status,
			scheduledAt,
			queued,
			options: { ...input.options, communityId: input.options?.communityId || undefined },
			recurFreq:
				input.action === 'draft' || input.action === 'now'
					? null
					: (input.recurrence?.freq ?? null),
			recurInterval: input.recurrence?.interval ?? 1,
			recurUntil: input.recurrence?.until ?? null,
			attempts: 0,
			nextAttemptAt: null,
			leaseUntil: null,
			lastError: null,
			errorKind: null,
			updatedAt: now
		};

		db.transaction((tx) => {
			if (input.id) {
				const existing = tx.select().from(schema.posts).where(eq(schema.posts.id, input.id)).get();
				if (!existing) throw new ComposeError('This post no longer exists.');
				if (!EDITABLE.includes(existing.status)) {
					throw new ComposeError(
						'This post is publishing or already published and cannot be edited.'
					);
				}
				const published = tx
					.select({ n: sql<number>`count(*)` })
					.from(schema.postItems)
					.where(and(eq(schema.postItems.postId, input.id), isNotNull(schema.postItems.xPostId)))
					.get()!.n;
				if (published > 0) {
					throw new ComposeError(
						'Part of this thread is already on X. Duplicate it to post a new copy.'
					);
				}
				tx.update(schema.posts).set(values).where(eq(schema.posts.id, input.id)).run();
				tx.delete(schema.postItems).where(eq(schema.postItems.postId, input.id)).run();
				writeItems(tx, input.id, input);
				ids.push(input.id);
			} else {
				const id = crypto.randomUUID();
				tx.insert(schema.posts)
					.values({ id, ...values, createdAt: now })
					.run();
				writeItems(tx, id, input);
				ids.push(id);
			}
		});
	}
	return ids;
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

function hydrate(rows: PostRow[]): PostView[] {
	if (!rows.length) return [];
	const db = getDb();
	const ids = rows.map((r) => r.id);
	const items = db
		.select()
		.from(schema.postItems)
		.where(inArray(schema.postItems.postId, ids))
		.orderBy(asc(schema.postItems.position))
		.all();
	const links = items.length
		? db
				.select({ link: schema.postItemMedia, media: schema.media })
				.from(schema.postItemMedia)
				.innerJoin(schema.media, eq(schema.postItemMedia.mediaId, schema.media.id))
				.where(
					inArray(
						schema.postItemMedia.itemId,
						items.map((i) => i.id)
					)
				)
				.orderBy(asc(schema.postItemMedia.position))
				.all()
		: [];
	const accountIds = [...new Set(rows.map((r) => r.accountId))];
	const accounts = new Map(
		db
			.select()
			.from(schema.accounts)
			.where(inArray(schema.accounts.id, accountIds))
			.all()
			.map((a) => [a.id, a])
	);
	const rates = getSettings().rates;

	return rows.map((p) => {
		const own: PostItemView[] = items
			.filter((i) => i.postId === p.id)
			.map((i) => ({
				id: i.id,
				position: i.position,
				text: i.text,
				poll: i.poll ?? null,
				xPostId: i.xPostId,
				media: links
					.filter((l) => l.link.itemId === i.id)
					.map((l) => ({ ...toInfo(l.media), attachedAlt: l.link.altText }))
			}));
		const unpublished = own.filter((i) => !i.xPostId);
		const a = accounts.get(p.accountId);
		return {
			id: p.id,
			accountId: p.accountId,
			account: {
				username: a?.username ?? 'unknown',
				displayName: a?.displayName ?? 'Unknown',
				avatarUrl: a?.avatarUrl ?? null
			},
			status: p.status,
			scheduledAt: p.scheduledAt,
			publishedAt: p.publishedAt,
			queued: p.queued,
			options: p.options,
			recurFreq: p.recurFreq,
			recurInterval: p.recurInterval,
			recurUntil: p.recurUntil,
			attempts: p.attempts,
			nextAttemptAt: p.nextAttemptAt,
			errorKind: p.errorKind,
			lastError: p.lastError,
			items: own,
			estCost: estimateCost(
				unpublished.map((i) => ({
					text: i.text,
					media: i.media.map((m) => ({ kind: m.kind, altText: m.attachedAlt }))
				})),
				rates
			).total,
			createdAt: p.createdAt,
			updatedAt: p.updatedAt
		};
	});
}

export function getPost(id: string): PostView | null {
	const row = getDb().select().from(schema.posts).where(eq(schema.posts.id, id)).get();
	return row ? hydrate([row])[0] : null;
}

function query(where: SQL | undefined, order: SQL[], limit?: number, offset = 0): PostView[] {
	let q = getDb()
		.select()
		.from(schema.posts)
		.where(where)
		.orderBy(...order)
		.$dynamic();
	if (limit) q = q.limit(limit).offset(offset);
	return hydrate(q.all());
}

export function listUpcoming(limit = 6, accountId?: string): PostView[] {
	return query(
		and(
			inArray(schema.posts.status, ['scheduled', 'publishing']),
			accountId ? eq(schema.posts.accountId, accountId) : undefined
		),
		[asc(schema.posts.scheduledAt)],
		limit
	);
}

export function listAttention(): PostView[] {
	return query(inArray(schema.posts.status, ['failed', 'paused', 'missed', 'needs_verification']), [
		desc(schema.posts.updatedAt)
	]);
}

export function listDrafts(): PostView[] {
	return query(eq(schema.posts.status, 'draft'), [desc(schema.posts.updatedAt)]);
}

export function listQueue(accountId: string): PostView[] {
	return query(
		and(
			eq(schema.posts.accountId, accountId),
			eq(schema.posts.queued, true),
			eq(schema.posts.status, 'scheduled')
		),
		[asc(schema.posts.scheduledAt)]
	);
}

export function listCalendar(start: number, end: number, accountId?: string): PostView[] {
	const inRange = or(
		and(gte(schema.posts.scheduledAt, start), lt(schema.posts.scheduledAt, end)),
		and(gte(schema.posts.publishedAt, start), lt(schema.posts.publishedAt, end))
	);
	return query(
		and(
			inRange,
			sql`${schema.posts.status} != 'draft'`,
			accountId ? eq(schema.posts.accountId, accountId) : undefined
		),
		[asc(schema.posts.scheduledAt)]
	);
}

export function listHistory(
	filter: 'published' | 'failed',
	page: number,
	pageSize = 20,
	accountId?: string
) {
	const where = and(
		filter === 'published'
			? eq(schema.posts.status, 'published')
			: inArray(schema.posts.status, ['failed', 'missed']),
		accountId ? eq(schema.posts.accountId, accountId) : undefined
	);
	const total = getDb()
		.select({ n: sql<number>`count(*)` })
		.from(schema.posts)
		.where(where)
		.get()!.n;
	const posts = query(
		where,
		[desc(sql`coalesce(${schema.posts.publishedAt}, ${schema.posts.updatedAt})`)],
		pageSize,
		(page - 1) * pageSize
	);
	return { posts, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function counts() {
	const rows = getDb()
		.select({ status: schema.posts.status, n: sql<number>`count(*)` })
		.from(schema.posts)
		.groupBy(schema.posts.status)
		.all();
	return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
		Record<PostStatus, number>
	>;
}

/** Estimated cost of everything still scheduled before `end`. */
export function projectedSpend(end: number): number {
	const rows = getDb()
		.select()
		.from(schema.posts)
		.where(
			and(
				inArray(schema.posts.status, ['scheduled', 'paused', 'needs_verification']),
				lt(schema.posts.scheduledAt, end)
			)
		)
		.all();
	return hydrate(rows).reduce((sum, p) => sum + p.estCost, 0);
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

function update(id: string, set: Partial<PostRow>, allowed: PostStatus[]): boolean {
	return (
		getDb()
			.update(schema.posts)
			.set({ ...set, updatedAt: Date.now() })
			.where(and(eq(schema.posts.id, id), inArray(schema.posts.status, allowed)))
			.run().changes > 0
	);
}

export function deletePost(id: string): boolean {
	return (
		getDb()
			.delete(schema.posts)
			.where(and(eq(schema.posts.id, id), sql`${schema.posts.status} != 'publishing'`))
			.run().changes > 0
	);
}

/** Retry / resume / publish-now for failed, paused and missed posts. */
export function retryNow(id: string): boolean {
	return update(
		id,
		{
			status: 'scheduled',
			scheduledAt: Date.now(),
			nextAttemptAt: null,
			attempts: 0,
			errorKind: null,
			lastError: null
		},
		['failed', 'paused', 'missed', 'draft']
	);
}

/** Moves a post to a new time. Failed/paused/missed posts become scheduled again. */
export function reschedule(id: string, at: number): boolean {
	const ok = update(id, { scheduledAt: at, queued: false, nextAttemptAt: null }, [
		'scheduled',
		'draft',
		'paused',
		'missed',
		'failed'
	]);
	if (ok) {
		update(id, { status: 'scheduled', attempts: 0, errorKind: null, lastError: null }, [
			'paused',
			'missed',
			'failed'
		]);
	}
	return ok;
}

export function moveToDrafts(id: string): boolean {
	return update(id, { status: 'draft', queued: false, nextAttemptAt: null }, [
		'scheduled',
		'failed',
		'paused',
		'missed'
	]);
}

export function duplicatePost(id: string): string | null {
	const post = getPost(id);
	if (!post) return null;
	const [newId] = savePost({
		accountIds: [post.accountId],
		items: post.items.map((i) => ({
			text: i.text,
			poll: i.poll,
			media: i.media.map((m) => ({ id: m.id, altText: m.attachedAlt }))
		})),
		options: post.options,
		action: 'draft'
	});
	return newId;
}

export function shiftPosts(ids: string[], deltaMs: number): number {
	let n = 0;
	const db = getDb();
	db.transaction((tx) => {
		for (const id of ids) {
			const p = tx.select().from(schema.posts).where(eq(schema.posts.id, id)).get();
			if (!p || p.scheduledAt === null || !['scheduled', 'draft'].includes(p.status)) continue;
			tx.update(schema.posts)
				.set({
					scheduledAt: Math.max(Date.now() + 60_000, p.scheduledAt + deltaMs),
					queued: false,
					updatedAt: Date.now()
				})
				.where(eq(schema.posts.id, id))
				.run();
			n++;
		}
	});
	return n;
}

/** Resume every post paused for budget or credit reasons (after the user raised the budget, etc). */
export function resumePaused(kinds: ('budget' | 'credits')[]): number {
	return getDb()
		.update(schema.posts)
		.set({
			status: 'scheduled',
			scheduledAt: notInPast(),
			errorKind: null,
			lastError: null,
			nextAttemptAt: null,
			updatedAt: Date.now()
		})
		.where(and(eq(schema.posts.status, 'paused'), inArray(schema.posts.errorKind, kinds)))
		.run().changes;
}
