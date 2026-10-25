import { randomInt } from 'node:crypto';
import type { MediaKind } from '../../shared/types.js';
import { XError } from './types.js';
import type { CreatePostPayload, RecentPost, XApi, XUser } from './types.js';

interface MockStore {
	posts: Map<string, RecentPost[]>;
	media: Set<string>;
	latencyMs: number;
}

const g = globalThis as typeof globalThis & { __schedxMockX?: MockStore };
export const mockStore: MockStore = (g.__schedxMockX ??= {
	posts: new Map(),
	media: new Set(),
	latencyMs: 150
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeId(): string {
	return `${Date.now()}${randomInt(100000, 999999)}`;
}

/**
 * Failure injection for manual testing in mock mode: put a marker like `[fail:transient]` in
 * the post text. `[fail:ambiguous]` records the post *and then* throws, like a timeout after X
 * accepted the request.
 */
function injectedFailure(text: string): string | null {
	return /\[fail:([a-z_]+)\]/.exec(text)?.[1] ?? null;
}

export class MockXApi implements XApi {
	constructor(private readonly user: XUser) {}

	async me(): Promise<XUser> {
		await sleep(mockStore.latencyMs);
		return this.user;
	}

	async createPost(payload: CreatePostPayload): Promise<{ id: string }> {
		await sleep(mockStore.latencyMs);
		if (payload.mediaIds?.some((id) => !mockStore.media.has(id))) {
			throw new XError('invalid', 'Mock X: unknown media id', { status: 400 });
		}
		const fail = injectedFailure(payload.text);
		const record = () => {
			const post = { id: fakeId(), text: payload.text, createdAt: Date.now() };
			const list = mockStore.posts.get(this.user.id) ?? [];
			list.unshift(post);
			mockStore.posts.set(this.user.id, list.slice(0, 200));
			return post;
		};
		switch (fail) {
			case null:
				return { id: record().id };
			case 'ambiguous':
				record();
				throw new XError('ambiguous', 'Mock X: connection reset after request was sent');
			case 'transient':
				throw new XError('transient', 'Mock X 503: Service Unavailable', { status: 503 });
			case 'duplicate':
				throw new XError(
					'duplicate',
					'Mock X 403: You are not allowed to create a Tweet with duplicate content.',
					{ status: 403 }
				);
			case 'forbidden':
				throw new XError('forbidden', 'Mock X 403: Reply to this post is not allowed.', {
					status: 403
				});
			case 'auth':
				throw new XError('auth', 'Mock X 401: Unauthorized', { status: 401 });
			case 'credits':
				throw new XError('credits', 'Mock X 402: Your account has run out of credits.', {
					status: 402
				});
			case 'rate':
				throw new XError('rate_limit', 'Mock X 429: Too Many Requests', {
					status: 429,
					retryAt: Date.now() + 60_000
				});
			default:
				return { id: record().id };
		}
	}

	async uploadMedia(_data: Buffer, _mime: string, kind: MediaKind): Promise<string> {
		await sleep(kind === 'video' ? 1000 : mockStore.latencyMs);
		const id = fakeId();
		mockStore.media.add(id);
		return id;
	}

	async setAltText(mediaId: string): Promise<void> {
		await sleep(mockStore.latencyMs);
		if (!mockStore.media.has(mediaId)) throw new XError('invalid', 'Mock X: unknown media id');
	}

	async recentPosts(xUserId: string, sinceMs: number): Promise<RecentPost[]> {
		await sleep(mockStore.latencyMs);
		return (mockStore.posts.get(xUserId) ?? []).filter((p) => p.createdAt >= sinceMs).slice(0, 10);
	}
}
