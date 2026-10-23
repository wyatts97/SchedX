import { TwitterApi } from 'twitter-api-v2';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';
import { notInPast } from '../db/helpers.js';
import { decrypt, encrypt } from '../crypto.js';
import { rt } from '../runtime.js';
import { logger, errorMessage } from '../logger.js';
import { notify } from '../notify/index.js';
import { hasUrl } from '../../shared/text.js';
import { classifyXError } from './errors.js';
import { recordUsage } from './ledger.js';
import { LiveXApi } from './live.js';
import { MockXApi } from './mock.js';
import { XError, type XApi, type XUser } from './types.js';

export type AccountRow = typeof schema.accounts.$inferSelect;

export interface AccountView {
	id: string;
	xUserId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: AccountRow['status'];
	lastError: string | null;
	isDefault: boolean;
	premium: boolean;
	scopes: string[];
	createdAt: number;
}

export const REQUIRED_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'];
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function toView(a: AccountRow): AccountView {
	return {
		id: a.id,
		xUserId: a.xUserId,
		username: a.username,
		displayName: a.displayName,
		avatarUrl: a.avatarUrl,
		status: a.status,
		lastError: a.lastError,
		isDefault: a.isDefault,
		premium: a.premium,
		scopes: a.scopes.split(/[ ,]+/).filter(Boolean),
		createdAt: a.createdAt
	};
}

export function listAccounts(): AccountView[] {
	return getDb()
		.select()
		.from(schema.accounts)
		.orderBy(sql`${schema.accounts.isDefault} desc`, schema.accounts.username)
		.all()
		.map(toView);
}

export function getAccount(id: string): AccountRow | undefined {
	return getDb().select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
}

export function upsertAccount(input: {
	user: XUser;
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	scopes: string[];
}): AccountRow {
	const db = getDb();
	const hasAny = !!db.select({ id: schema.accounts.id }).from(schema.accounts).limit(1).get();
	const values = {
		xUserId: input.user.id,
		username: input.user.username,
		displayName: input.user.name,
		avatarUrl: input.user.avatarUrl ?? null,
		accessTokenEnc: encrypt(input.accessToken),
		refreshTokenEnc: input.refreshToken ? encrypt(input.refreshToken) : null,
		expiresAt: Date.now() + input.expiresIn * 1000,
		scopes: input.scopes.join(' '),
		status: 'active' as const,
		lastError: null,
		updatedAt: Date.now()
	};
	const row = db
		.insert(schema.accounts)
		.values({ ...values, isDefault: !hasAny })
		.onConflictDoUpdate({ target: schema.accounts.xUserId, set: values })
		.returning()
		.get();
	// Reconnecting resumes anything that was paused because the account needed re-auth.
	db.update(schema.posts)
		.set({
			status: 'scheduled',
			scheduledAt: notInPast(),
			errorKind: null,
			lastError: null,
			nextAttemptAt: null,
			updatedAt: Date.now()
		})
		.where(
			and(
				eq(schema.posts.accountId, row.id),
				eq(schema.posts.status, 'paused'),
				eq(schema.posts.errorKind, 'auth')
			)
		)
		.run();
	return row;
}

export function setDefaultAccount(id: string): void {
	const db = getDb();
	db.transaction((tx) => {
		tx.update(schema.accounts).set({ isDefault: false }).where(ne(schema.accounts.id, id)).run();
		tx.update(schema.accounts).set({ isDefault: true }).where(eq(schema.accounts.id, id)).run();
	});
}

export function setPremium(id: string, premium: boolean): void {
	getDb().update(schema.accounts).set({ premium }).where(eq(schema.accounts.id, id)).run();
}

export function pendingPostCount(accountId: string): number {
	return getDb()
		.select({ n: sql<number>`count(*)` })
		.from(schema.posts)
		.where(
			and(
				eq(schema.posts.accountId, accountId),
				inArray(schema.posts.status, ['scheduled', 'draft', 'paused', 'needs_verification', 'missed'])
			)
		)
		.get()!.n;
}

/** Revokes the token at X (best effort) and deletes the account with its posts. */
export async function disconnectAccount(id: string): Promise<void> {
	const account = getAccount(id);
	if (!account) return;
	const { xMode, xClientId, xClientSecret } = rt();
	if (xMode === 'live' && xClientId && xClientSecret && account.refreshTokenEnc) {
		try {
			const app = new TwitterApi({ clientId: xClientId, clientSecret: xClientSecret });
			await app.revokeOAuth2Token(decrypt(account.refreshTokenEnc), 'refresh_token');
		} catch (err) {
			logger.warn({ err: errorMessage(err) }, 'token revoke failed (continuing)');
		}
	}
	const db = getDb();
	db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
	if (account.isDefault) {
		const next = db.select().from(schema.accounts).limit(1).get();
		if (next) setDefaultAccount(next.id);
	}
}

export async function markNeedsReauth(account: AccountRow, reason: string): Promise<void> {
	getDb()
		.update(schema.accounts)
		.set({ status: 'needs_reauth', lastError: reason, updatedAt: Date.now() })
		.where(eq(schema.accounts.id, account.id))
		.run();
	await notify({
		event: 'needs_reauth',
		title: `Reconnect @${account.username}`,
		body: 'SchedX lost access to this X account. Reconnect it to resume posting.',
		url: '/accounts'
	});
}

// --- token refresh, serialised per account so a rotated refresh token is never used twice ---

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const prev = locks.get(key) ?? Promise.resolve();
	const run = prev.catch(() => undefined).then(fn);
	locks.set(key, run);
	try {
		return await run;
	} finally {
		if (locks.get(key) === run) locks.delete(key);
	}
}

async function freshAccessToken(accountId: string): Promise<{ account: AccountRow; token: string }> {
	return withLock(accountId, async () => {
		const account = getAccount(accountId);
		if (!account) throw new XError('invalid', 'Account no longer exists');
		if (account.status === 'needs_reauth') {
			throw new XError('auth', `@${account.username} needs to be reconnected`);
		}
		if (account.expiresAt - Date.now() > REFRESH_MARGIN_MS) {
			return { account, token: decrypt(account.accessTokenEnc) };
		}
		const { xClientId, xClientSecret } = rt();
		if (!account.refreshTokenEnc || !xClientId || !xClientSecret) {
			await markNeedsReauth(account, 'Access token expired and cannot be refreshed');
			throw new XError('auth', 'Access token expired and cannot be refreshed');
		}
		try {
			const app = new TwitterApi({ clientId: xClientId, clientSecret: xClientSecret });
			const res = await app.refreshOAuth2Token(decrypt(account.refreshTokenEnc));
			const updated = getDb()
				.update(schema.accounts)
				.set({
					accessTokenEnc: encrypt(res.accessToken),
					refreshTokenEnc: res.refreshToken ? encrypt(res.refreshToken) : account.refreshTokenEnc,
					expiresAt: Date.now() + res.expiresIn * 1000,
					scopes: res.scope?.length ? res.scope.join(' ') : account.scopes,
					lastError: null,
					updatedAt: Date.now()
				})
				.where(eq(schema.accounts.id, account.id))
				.returning()
				.get();
			return { account: updated, token: res.accessToken };
		} catch (err) {
			const xe = classifyXError(err, 'auth');
			if (xe.kind === 'auth' || xe.kind === 'invalid') {
				await markNeedsReauth(account, xe.message);
				throw new XError('auth', xe.message, { status: xe.status });
			}
			throw xe;
		}
	});
}

export interface ApiContext {
	accountId: string;
	postId?: string;
}

/**
 * Returns an X client for the account with a valid access token. Every billable call made
 * through it is written to the cost ledger.
 */
export async function getXApi(ctx: ApiContext): Promise<{ api: XApi; account: AccountRow }> {
	let account: AccountRow;
	let inner: XApi;
	if (rt().xMode === 'mock') {
		const row = getAccount(ctx.accountId);
		if (!row) throw new XError('invalid', 'Account no longer exists');
		if (row.status === 'needs_reauth') throw new XError('auth', `@${row.username} needs to be reconnected`);
		account = row;
		inner = new MockXApi({ id: row.xUserId, username: row.username, name: row.displayName });
	} else {
		const fresh = await freshAccessToken(ctx.accountId);
		account = fresh.account;
		inner = new LiveXApi(new TwitterApi(fresh.token));
	}
	return { api: withLedger(inner, ctx), account };
}

export function withLedger(api: XApi, ctx: { accountId?: string; postId?: string }): XApi {
	const base = { accountId: ctx.accountId, postId: ctx.postId };
	return {
		async me() {
			const u = await api.me();
			recordUsage({ ...base, op: 'user.read' });
			return u;
		},
		async createPost(payload) {
			const res = await api.createPost(payload);
			recordUsage({ ...base, op: hasUrl(payload.text) ? 'post.create_url' : 'post.create' });
			return res;
		},
		uploadMedia: (data, mime, kind) => api.uploadMedia(data, mime, kind),
		async setAltText(mediaId, text) {
			await api.setAltText(mediaId, text);
			recordUsage({ ...base, op: 'media.metadata' });
		},
		async recentPosts(xUserId, sinceMs) {
			const posts = await api.recentPosts(xUserId, sinceMs);
			recordUsage({ ...base, op: 'post.read.owned', units: posts.length });
			return posts;
		}
	};
}
