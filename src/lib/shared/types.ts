export type Theme = 'system' | 'light' | 'dark' | 'black';

export type PostStatus =
	| 'draft'
	| 'scheduled'
	| 'publishing'
	| 'published'
	| 'failed'
	| 'needs_verification'
	| 'paused'
	| 'missed';

export type AccountStatus = 'active' | 'needs_reauth';

export type ErrorKind =
	| 'auth'
	| 'duplicate'
	| 'forbidden'
	| 'credits'
	| 'rate_limit'
	| 'transient'
	| 'ambiguous'
	| 'budget'
	| 'invalid'
	| 'unknown';

export type RecurFreq = 'daily' | 'weekly' | 'monthly';

export type MediaKind = 'image' | 'gif' | 'video';

export type ReplySettings = 'everyone' | 'following' | 'mentionedUsers' | 'subscribers' | 'verified';

export interface PostOptions {
	replySettings?: ReplySettings;
	communityId?: string;
	shareWithFollowers?: boolean;
	madeWithAi?: boolean;
	paidPartnership?: boolean;
}

export interface PollInput {
	options: string[];
	durationMinutes: number;
}

export interface Rates {
	post: number;
	postWithUrl: number;
	mediaMetadata: number;
	userRead: number;
	postRead: number;
	ownedRead: number;
}

/** X pay-per-use prices as published on docs.x.com (Oct 2026). Editable in Settings. */
export const DEFAULT_RATES: Rates = {
	post: 0.015,
	postWithUrl: 0.2,
	mediaMetadata: 0.005,
	userRead: 0.01,
	postRead: 0.005,
	ownedRead: 0.001
};

export type NotificationEvent =
	| 'published'
	| 'failed'
	| 'needs_reauth'
	| 'paused'
	| 'budget_warning'
	| 'missed';

export const NOTIFICATION_EVENTS: { id: NotificationEvent; label: string }[] = [
	{ id: 'published', label: 'Post published' },
	{ id: 'failed', label: 'Post failed' },
	{ id: 'needs_reauth', label: 'Account needs to be reconnected' },
	{ id: 'paused', label: 'Publishing paused (budget or credits)' },
	{ id: 'budget_warning', label: 'Budget warning threshold reached' },
	{ id: 'missed', label: 'Post missed while the server was down' }
];

export const STATUS_LABELS: Record<PostStatus, string> = {
	draft: 'Draft',
	scheduled: 'Scheduled',
	publishing: 'Publishing',
	published: 'Published',
	failed: 'Failed',
	needs_verification: 'Verifying',
	paused: 'Paused',
	missed: 'Missed'
};

/** Statuses that need the user's attention on the dashboard. */
export const ATTENTION_STATUSES: PostStatus[] = ['failed', 'paused', 'missed', 'needs_verification'];
