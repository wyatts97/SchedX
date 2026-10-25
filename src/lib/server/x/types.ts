import type { ErrorKind, MediaKind, PostOptions } from '../../shared/types.js';

export interface XUser {
	id: string;
	username: string;
	name: string;
	avatarUrl?: string;
}

export interface CreatePostPayload {
	text: string;
	mediaIds?: string[];
	poll?: { options: string[]; durationMinutes: number };
	replyTo?: string;
	/** Applied in full to the first post of a thread; disclosures apply to every post. */
	options?: PostOptions;
	isFirst?: boolean;
}

export interface RecentPost {
	id: string;
	text: string;
	createdAt: number;
}

/** The subset of the X API that SchedX uses. Implemented by the live client and the mock. */
export interface XApi {
	me(): Promise<XUser>;
	createPost(payload: CreatePostPayload): Promise<{ id: string }>;
	uploadMedia(data: Buffer, mime: string, kind: MediaKind): Promise<string>;
	setAltText(mediaId: string, text: string): Promise<void>;
	recentPosts(xUserId: string, sinceMs: number): Promise<RecentPost[]>;
}

export class XError extends Error {
	readonly kind: ErrorKind;
	readonly status?: number;
	/** For rate limits: epoch ms when it is safe to retry. */
	readonly retryAt?: number;

	constructor(kind: ErrorKind, message: string, opts: { status?: number; retryAt?: number } = {}) {
		super(message);
		this.name = 'XError';
		this.kind = kind;
		this.status = opts.status;
		this.retryAt = opts.retryAt;
	}
}
