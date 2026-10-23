import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
	AccountStatus,
	ErrorKind,
	PollInput,
	PostOptions,
	PostStatus,
	RecurFreq,
	MediaKind
} from '../../shared/types.js';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const now = () => Date.now();

export const users = sqliteTable('users', {
	id: id(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	timezone: text('timezone').notNull().default('UTC'),
	createdAt: integer('created_at').notNull().$defaultFn(now),
	passwordChangedAt: integer('password_changed_at').notNull().$defaultFn(now)
});

export const sessions = sqliteTable(
	'sessions',
	{
		// sha256 of the session token; the raw token only lives in the cookie
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at').notNull(),
		createdAt: integer('created_at').notNull().$defaultFn(now),
		userAgent: text('user_agent')
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const accounts = sqliteTable('accounts', {
	id: id(),
	xUserId: text('x_user_id').notNull().unique(),
	username: text('username').notNull(),
	displayName: text('display_name').notNull(),
	avatarUrl: text('avatar_url'),
	accessTokenEnc: text('access_token_enc').notNull(),
	refreshTokenEnc: text('refresh_token_enc'),
	expiresAt: integer('expires_at').notNull(),
	scopes: text('scopes').notNull().default(''),
	status: text('status').$type<AccountStatus>().notNull().default('active'),
	lastError: text('last_error'),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	premium: integer('premium', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull().$defaultFn(now),
	updatedAt: integer('updated_at').notNull().$defaultFn(now)
});

export const posts = sqliteTable(
	'posts',
	{
		id: id(),
		accountId: text('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		status: text('status').$type<PostStatus>().notNull(),
		scheduledAt: integer('scheduled_at'),
		queued: integer('queued', { mode: 'boolean' }).notNull().default(false),
		options: text('options', { mode: 'json' }).$type<PostOptions>().notNull().default({}),
		recurFreq: text('recur_freq').$type<RecurFreq>(),
		recurInterval: integer('recur_interval').notNull().default(1),
		recurUntil: integer('recur_until'),
		seriesId: text('series_id'),
		attempts: integer('attempts').notNull().default(0),
		nextAttemptAt: integer('next_attempt_at'),
		leaseUntil: integer('lease_until'),
		lastError: text('last_error'),
		errorKind: text('error_kind').$type<ErrorKind>(),
		publishedAt: integer('published_at'),
		createdAt: integer('created_at').notNull().$defaultFn(now),
		updatedAt: integer('updated_at').notNull().$defaultFn(now)
	},
	(t) => [
		index('posts_status_sched_idx').on(t.status, t.scheduledAt),
		index('posts_account_idx').on(t.accountId, t.status)
	]
);

export const postItems = sqliteTable(
	'post_items',
	{
		id: id(),
		postId: text('post_id')
			.notNull()
			.references(() => posts.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		text: text('text').notNull().default(''),
		poll: text('poll', { mode: 'json' }).$type<PollInput | null>(),
		xPostId: text('x_post_id'),
		publishedAt: integer('published_at')
	},
	(t) => [uniqueIndex('post_items_pos_idx').on(t.postId, t.position)]
);

export const media = sqliteTable('media', {
	id: id(),
	filename: text('filename').notNull(),
	originalName: text('original_name').notNull(),
	mime: text('mime').notNull(),
	kind: text('kind').$type<MediaKind>().notNull(),
	size: integer('size').notNull(),
	width: integer('width'),
	height: integer('height'),
	durationMs: integer('duration_ms'),
	thumbFilename: text('thumb_filename'),
	altText: text('alt_text').notNull().default(''),
	createdAt: integer('created_at').notNull().$defaultFn(now)
});

export const postItemMedia = sqliteTable(
	'post_item_media',
	{
		itemId: text('item_id')
			.notNull()
			.references(() => postItems.id, { onDelete: 'cascade' }),
		mediaId: text('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'restrict' }),
		position: integer('position').notNull(),
		altText: text('alt_text').notNull().default('')
	},
	(t) => [primaryKey({ columns: [t.itemId, t.position] }), index('pim_media_idx').on(t.mediaId)]
);

export const queueSlots = sqliteTable(
	'queue_slots',
	{
		id: id(),
		accountId: text('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'cascade' }),
		// ISO weekday: 1 = Monday … 7 = Sunday
		weekday: integer('weekday').notNull(),
		// minutes after local midnight in the user's timezone
		minutes: integer('minutes').notNull()
	},
	(t) => [uniqueIndex('queue_slots_unique_idx').on(t.accountId, t.weekday, t.minutes)]
);

export const apiLedger = sqliteTable(
	'api_ledger',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ts: integer('ts').notNull().$defaultFn(now),
		accountId: text('account_id'),
		postId: text('post_id'),
		op: text('op').notNull(),
		units: integer('units').notNull().default(1),
		costUsd: real('cost_usd').notNull()
	},
	(t) => [index('api_ledger_ts_idx').on(t.ts)]
);

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull(),
	updatedAt: integer('updated_at').notNull().$defaultFn(now)
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: id(),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	userAgent: text('user_agent'),
	createdAt: integer('created_at').notNull().$defaultFn(now)
});

export const oauthStates = sqliteTable('oauth_states', {
	state: text('state').primaryKey(),
	codeVerifier: text('code_verifier').notNull(),
	redirectUri: text('redirect_uri').notNull(),
	expiresAt: integer('expires_at').notNull()
});
