import { describe, expect, it } from 'vitest';
import { ApiRequestError, ApiResponseError } from 'twitter-api-v2';
import { classifyXError } from '#lib/server/x/errors.js';
import { buildPostBody } from '#lib/server/x/live.js';

function responseError(code: number, data: unknown, reset?: number) {
	return new ApiResponseError(`Request failed with code ${code}`, {
		code,
		data,
		headers: {},
		request: {} as never,
		response: {} as never,
		rateLimit: reset ? { limit: 1, remaining: 0, reset } : undefined
	} as never);
}

describe('classifyXError', () => {
	it('maps duplicate content to a permanent failure', () => {
		const e = classifyXError(
			responseError(403, { detail: 'You are not allowed to create a Tweet with duplicate content.' }),
			'post'
		);
		expect(e.kind).toBe('duplicate');
	});
	it('maps the reply restriction to forbidden', () => {
		const e = classifyXError(responseError(403, { detail: 'Reply to this post is not allowed' }), 'post');
		expect(e.kind).toBe('forbidden');
	});
	it('maps 402 and credit messages to credits', () => {
		expect(classifyXError(responseError(402, { title: 'Payment Required' }), 'post').kind).toBe('credits');
		expect(classifyXError(responseError(429, { detail: 'Usage cap exceeded: credits depleted' }), 'post').kind).toBe(
			'credits'
		);
	});
	it('uses the rate-limit reset header for 429', () => {
		const reset = Math.floor(Date.now() / 1000) + 600;
		const e = classifyXError(responseError(429, { title: 'Too Many Requests' }, reset), 'post');
		expect(e.kind).toBe('rate_limit');
		expect(e.retryAt).toBe(reset * 1000 + 1000);
	});
	it('treats a 5xx on post create as ambiguous but as transient elsewhere', () => {
		expect(classifyXError(responseError(503, {}), 'post').kind).toBe('ambiguous');
		expect(classifyXError(responseError(503, {}), 'media').kind).toBe('transient');
	});
	it('treats connection refused as safe to retry, resets as ambiguous', () => {
		const refused = new ApiRequestError('fail', {
			request: {} as never,
			requestError: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
		});
		const reset = new ApiRequestError('fail', {
			request: {} as never,
			requestError: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' })
		});
		expect(classifyXError(refused, 'post').kind).toBe('transient');
		expect(classifyXError(reset, 'post').kind).toBe('ambiguous');
	});
	it('maps 401 to auth', () => {
		expect(classifyXError(responseError(401, { title: 'Unauthorized' }), 'post').kind).toBe('auth');
	});
});

describe('buildPostBody', () => {
	it('only applies reply settings and community to the first post of a thread', () => {
		const options = { replySettings: 'following' as const, communityId: '123', madeWithAi: true };
		const first = buildPostBody({ text: 'a', options, isFirst: true });
		const reply = buildPostBody({ text: 'b', options, isFirst: false, replyTo: '99' });
		expect(first).toMatchObject({ reply_settings: 'following', community_id: '123', made_with_ai: true });
		expect(reply).toMatchObject({ reply: { in_reply_to_tweet_id: '99' }, made_with_ai: true });
		expect(reply).not.toHaveProperty('reply_settings');
		expect(reply).not.toHaveProperty('community_id');
	});
	it('maps polls to duration_minutes', () => {
		expect(buildPostBody({ text: 'q?', poll: { options: ['a', 'b'], durationMinutes: 60 } })).toMatchObject({
			poll: { options: ['a', 'b'], duration_minutes: 60 }
		});
	});
});
