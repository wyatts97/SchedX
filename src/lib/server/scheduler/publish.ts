import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { getSettings, setSetting } from '../settings.js';
import { getUser } from '../auth/index.js';
import { logger, errorMessage } from '../logger.js';
import { notify } from '../notify/index.js';
import { readMediaFile } from '../media/storage.js';
import { getAccount, getXApi, markNeedsReauth } from '../x/accounts.js';
import { classifyXError, isPermanent } from '../x/errors.js';
import { currentSpend } from '../x/ledger.js';
import { XError, type XApi } from '../x/types.js';
import { spawnNextOccurrence } from './recurrence.js';
import { altTextBillable, estimateCost, formatUsd } from '../../shared/cost.js';
import { normalizeForMatch } from '../../shared/text.js';
import { MINUTE } from '../../shared/time.js';

type PostRow = typeof schema.posts.$inferSelect;
type ItemRow = typeof schema.postItems.$inferSelect;

export const LEASE_MS = 10 * MINUTE;
export const MAX_ATTEMPTS = 5;
export const BACKOFF_MS = [1, 5, 15, 60, 360].map((m) => m * MINUTE);

function preview(text: string): string {
	const t = text.replace(/\s+/g, ' ').trim();
	return t.length > 80 ? `${t.slice(0, 77)}…` : t || '(media post)';
}

function setPost(id: string, set: Partial<PostRow>): void {
	getDb()
		.update(schema.posts)
		.set({ ...set, updatedAt: Date.now() })
		.where(eq(schema.posts.id, id))
		.run();
}

/** Atomically moves a due post to `publishing`. Only one caller can win. */
export function claimPost(id: string, now = Date.now()): boolean {
	return (
		getDb()
			.update(schema.posts)
			.set({
				status: 'publishing',
				leaseUntil: now + LEASE_MS,
				attempts: sql`${schema.posts.attempts} + 1`,
				updatedAt: now
			})
			.where(
				and(
					eq(schema.posts.id, id),
					eq(schema.posts.status, 'scheduled'),
					lte(schema.posts.scheduledAt, now),
					or(isNull(schema.posts.nextAttemptAt), lte(schema.posts.nextAttemptAt, now))
				)
			)
			.run().changes === 1
	);
}

function renewLease(id: string): void {
	getDb()
		.update(schema.posts)
		.set({ leaseUntil: Date.now() + LEASE_MS })
		.where(and(eq(schema.posts.id, id), eq(schema.posts.status, 'publishing')))
		.run();
}

function loadItems(postId: string): ItemRow[] {
	return getDb()
		.select()
		.from(schema.postItems)
		.where(eq(schema.postItems.postId, postId))
		.orderBy(asc(schema.postItems.position))
		.all();
}

function loadMedia(itemIds: string[]) {
	if (!itemIds.length) return [];
	return getDb()
		.select({ link: schema.postItemMedia, media: schema.media })
		.from(schema.postItemMedia)
		.innerJoin(schema.media, eq(schema.postItemMedia.mediaId, schema.media.id))
		.where(inArray(schema.postItemMedia.itemId, itemIds))
		.orderBy(asc(schema.postItemMedia.position))
		.all();
}

async function markPublished(post: PostRow): Promise<void> {
	const items = loadItems(post.id);
	setPost(post.id, {
		status: 'published',
		publishedAt: Date.now(),
		leaseUntil: null,
		nextAttemptAt: null,
		errorKind: null,
		lastError: null
	});
	const account = getAccount(post.accountId);
	const first = items[0];
	await notify({
		event: 'published',
		title: `Posted${account ? ` as @${account.username}` : ''}`,
		body:
			preview(first?.text ?? '') + (items.length > 1 ? ` (+${items.length - 1} in thread)` : ''),
		url: '/history'
	});
	continueSeries(post);
	await checkBudgetWarning();
}

function continueSeries(post: PostRow): void {
	try {
		spawnNextOccurrence(post, getUser()?.timezone ?? 'UTC');
	} catch (err) {
		logger.error({ err: errorMessage(err), postId: post.id }, 'failed to schedule next occurrence');
	}
}

async function checkBudgetWarning(): Promise<void> {
	const { budget, budgetWarnedCycle } = getSettings();
	if (budget.monthlyUsd <= 0) return;
	const { cycle, spent } = currentSpend();
	if (budgetWarnedCycle === cycle.key) return;
	if (spent >= (budget.monthlyUsd * budget.warnPct) / 100) {
		setSetting('budgetWarnedCycle', cycle.key);
		await notify({
			event: 'budget_warning',
			title: 'X API budget warning',
			body: `${formatUsd(spent)} of your ${formatUsd(budget.monthlyUsd)} monthly budget is used.`,
			url: '/settings/budget'
		});
	}
}

async function handleFailure(
	post: PostRow,
	err: unknown,
	phase: 'post' | 'media' | 'read'
): Promise<void> {
	const xe = err instanceof XError ? err : classifyXError(err, phase);
	const fresh =
		getDb().select().from(schema.posts).where(eq(schema.posts.id, post.id)).get() ?? post;
	const base = { leaseUntil: null, lastError: xe.message.slice(0, 1000), errorKind: xe.kind };
	const firstText = preview(loadItems(post.id)[0]?.text ?? '');
	logger.warn(
		{ postId: post.id, kind: xe.kind, err: xe.message, attempt: fresh.attempts },
		'publish failed'
	);

	switch (xe.kind) {
		case 'ambiguous':
			setPost(post.id, {
				...base,
				status: 'needs_verification',
				nextAttemptAt: Date.now() + MINUTE
			});
			return;
		case 'auth': {
			setPost(post.id, { ...base, status: 'paused', nextAttemptAt: null });
			const account = getAccount(post.accountId);
			if (account && account.status === 'active') await markNeedsReauth(account, xe.message);
			return;
		}
		case 'credits':
			setPost(post.id, { ...base, status: 'paused', nextAttemptAt: null });
			setSetting('publishingPaused', { reason: 'credits', since: Date.now(), message: xe.message });
			await notify({
				event: 'paused',
				title: 'Publishing paused: X credits',
				body: 'X rejected a post for billing reasons. Top up credits in the X Developer Console, then resume.',
				url: '/'
			});
			return;
		case 'rate_limit':
			// Rate limits are not the post's fault; don't burn an attempt.
			setPost(post.id, {
				...base,
				status: 'scheduled',
				attempts: Math.max(0, fresh.attempts - 1),
				nextAttemptAt: xe.retryAt ?? Date.now() + 15 * MINUTE
			});
			return;
	}

	if (isPermanent(xe.kind) || fresh.attempts >= MAX_ATTEMPTS) {
		setPost(post.id, { ...base, status: 'failed', nextAttemptAt: null });
		await notify({
			event: 'failed',
			title: 'Post failed',
			body: `${firstText} — ${xe.message}`,
			url: '/history?tab=failed'
		});
		continueSeries(fresh);
		return;
	}
	const delay = BACKOFF_MS[Math.min(fresh.attempts - 1, BACKOFF_MS.length - 1)];
	setPost(post.id, { ...base, status: 'scheduled', nextAttemptAt: Date.now() + delay });
}

/** Uploads an item's media and returns X media ids. Videos skip alt text (X only supports it for images/GIFs). */
async function uploadItemMedia(api: XApi, postId: string, itemId: string): Promise<string[]> {
	const ids: string[] = [];
	for (const { link, media } of loadMedia([itemId])) {
		renewLease(postId);
		const data = await readMediaFile(media);
		const mediaId = await api.uploadMedia(data, media.mime, media.kind);
		const alt = link.altText.trim();
		if (alt && altTextBillable({ kind: media.kind, altText: alt }))
			await api.setAltText(mediaId, alt);
		ids.push(mediaId);
	}
	return ids;
}

/**
 * Publishes one claimed post. Thread items that already have an X id are skipped, so a retry
 * resumes where the previous attempt stopped.
 */
export async function publishPost(postId: string): Promise<void> {
	const post = getDb().select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
	if (!post || post.status !== 'publishing') return;

	const items = loadItems(post.id);
	const pending = items.filter((i) => !i.xPostId);
	if (!pending.length) return markPublished(post);

	// Budget guard: block before spending anything.
	const { budget, rates } = getSettings();
	if (budget.monthlyUsd > 0) {
		const media = loadMedia(pending.map((i) => i.id));
		const cost = estimateCost(
			pending.map((i) => ({
				text: i.text,
				media: media
					.filter((m) => m.link.itemId === i.id)
					.map((m) => ({ kind: m.media.kind, altText: m.link.altText }))
			})),
			rates
		).total;
		const { spent } = currentSpend();
		if (spent + cost > budget.monthlyUsd) {
			const message = `Monthly budget reached (${formatUsd(spent)} spent of ${formatUsd(budget.monthlyUsd)}; this post needs ${formatUsd(cost)}).`;
			setPost(post.id, {
				status: 'paused',
				errorKind: 'budget',
				lastError: message,
				leaseUntil: null,
				attempts: Math.max(0, post.attempts - 1)
			});
			await notify({
				event: 'paused',
				title: 'Post paused: budget reached',
				body: message,
				url: '/settings/budget'
			});
			return;
		}
	}

	let api: XApi;
	try {
		({ api } = await getXApi({ accountId: post.accountId, postId: post.id }));
	} catch (err) {
		return handleFailure(post, err, 'read');
	}

	let replyTo = [...items].reverse().find((i) => i.xPostId)?.xPostId ?? undefined;
	for (const item of pending) {
		let phase: 'media' | 'post' = 'media';
		try {
			renewLease(post.id);
			const mediaIds = await uploadItemMedia(api, post.id, item.id);
			phase = 'post';
			renewLease(post.id);
			const res = await api.createPost({
				text: item.text,
				mediaIds,
				poll: item.position === 0 && item.poll ? item.poll : undefined,
				replyTo,
				options: post.options,
				isFirst: item.position === 0
			});
			getDb()
				.update(schema.postItems)
				.set({ xPostId: res.id, publishedAt: Date.now() })
				.where(eq(schema.postItems.id, item.id))
				.run();
			replyTo = res.id;
		} catch (err) {
			return handleFailure(post, err, phase);
		}
	}
	return markPublished(post);
}

/**
 * Resolves a post whose outcome is unknown (timeout after sending, or the server stopped
 * mid-publish) by looking for it on the account's timeline.
 */
export async function verifyPost(postId: string): Promise<void> {
	const post = getDb().select().from(schema.posts).where(eq(schema.posts.id, postId)).get();
	if (!post || post.status !== 'needs_verification') return;
	const items = loadItems(post.id);
	const next = items.find((i) => !i.xPostId);
	if (!next) return markPublished(post);

	try {
		const { api, account } = await getXApi({ accountId: post.accountId, postId: post.id });
		const since =
			Math.min(post.updatedAt, post.leaseUntil ?? post.updatedAt) - LEASE_MS - 2 * MINUTE;
		const recent = await api.recentPosts(account.xUserId, since);
		const want = normalizeForMatch(next.text);
		const match = recent.find((r) => normalizeForMatch(r.text) === want);
		if (match) {
			getDb()
				.update(schema.postItems)
				.set({ xPostId: match.id, publishedAt: match.createdAt })
				.where(eq(schema.postItems.id, next.id))
				.run();
			logger.info({ postId, xPostId: match.id }, 'verification: post was already on X');
			if (items.every((i) => i.id === next.id || i.xPostId)) return markPublished(post);
		} else {
			logger.info({ postId }, 'verification: not found on X, will retry');
		}
		// Continue (or retry) the remaining items through the normal pipeline.
		setPost(post.id, { status: 'scheduled', nextAttemptAt: null, leaseUntil: null });
	} catch (err) {
		const xe = classifyXError(err, 'read');
		if (xe.kind === 'auth') return handleFailure(post, xe, 'read');
		logger.warn({ postId, err: xe.message }, 'verification failed, will try again');
		setPost(post.id, {
			nextAttemptAt: Date.now() + 2 * MINUTE,
			lastError: `Verification: ${xe.message}`
		});
	}
}
