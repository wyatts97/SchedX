import type {
	AccountStatus,
	MediaKind,
	PollInput,
	PostOptions,
	PostStatus,
	RecurFreq
} from './types.js';

/** An X account as the UI sees it (never includes tokens). */
export interface AccountView {
	id: string;
	xUserId: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	status: AccountStatus;
	lastError: string | null;
	isDefault: boolean;
	premium: boolean;
	scopes: string[];
	createdAt: number;
}

export type ComposeAction = 'draft' | 'schedule' | 'queue' | 'now';

export interface ComposeMediaRef {
	id: string;
	altText: string;
}

export interface ComposeItem {
	text: string;
	media: ComposeMediaRef[];
	poll?: PollInput | null;
}

export interface ComposeInput {
	/** Set when editing an existing post. */
	id?: string;
	/** One post is created per account (cross-posting). Editing allows exactly one. */
	accountIds: string[];
	items: ComposeItem[];
	options: PostOptions;
	action: ComposeAction;
	scheduledAt?: number | null;
	recurrence?: { freq: RecurFreq; interval: number; until: number | null } | null;
}

/** Media as shown in the composer and library. */
export interface MediaInfo {
	id: string;
	kind: MediaKind;
	mime: string;
	size: number;
	width: number | null;
	height: number | null;
	durationMs: number | null;
	altText: string;
	originalName: string;
	url: string;
	thumbUrl: string;
	createdAt: number;
}

export interface PostItemView {
	id: string;
	position: number;
	text: string;
	poll: PollInput | null;
	xPostId: string | null;
	media: (MediaInfo & { attachedAlt: string })[];
}

export interface PostView {
	id: string;
	accountId: string;
	account: { username: string; displayName: string; avatarUrl: string | null };
	status: PostStatus;
	scheduledAt: number | null;
	publishedAt: number | null;
	queued: boolean;
	options: PostOptions;
	recurFreq: RecurFreq | null;
	recurInterval: number;
	recurUntil: number | null;
	attempts: number;
	nextAttemptAt: number | null;
	errorKind: string | null;
	lastError: string | null;
	items: PostItemView[];
	estCost: number;
	createdAt: number;
	updatedAt: number;
}
