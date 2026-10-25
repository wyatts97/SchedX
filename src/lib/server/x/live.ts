import type { SendTweetV2Params, TwitterApi } from 'twitter-api-v2';
import type { MediaKind } from '../../shared/types.js';
import { classifyXError } from './errors.js';
import type { CreatePostPayload, RecentPost, XApi, XUser } from './types.js';

const CHUNK_BYTES = 4 * 1024 * 1024;

export function buildPostBody(p: CreatePostPayload): Record<string, unknown> {
	const body: Record<string, unknown> = { text: p.text };
	if (p.mediaIds?.length) body.media = { media_ids: p.mediaIds };
	if (p.poll) body.poll = { options: p.poll.options, duration_minutes: p.poll.durationMinutes };
	if (p.replyTo) body.reply = { in_reply_to_tweet_id: p.replyTo };
	const o = p.options ?? {};
	if (p.isFirst !== false) {
		if (o.replySettings && o.replySettings !== 'everyone') body.reply_settings = o.replySettings;
		if (o.communityId) {
			body.community_id = o.communityId;
			if (o.shareWithFollowers) body.share_with_followers = true;
		}
	}
	if (o.madeWithAi) body.made_with_ai = true;
	if (o.paidPartnership) body.paid_partnership = true;
	return body;
}

export class LiveXApi implements XApi {
	constructor(private readonly client: TwitterApi) {}

	async me(): Promise<XUser> {
		try {
			const { data } = await this.client.v2.me({ 'user.fields': ['profile_image_url'] });
			return {
				id: data.id,
				username: data.username,
				name: data.name,
				avatarUrl: data.profile_image_url?.replace('_normal.', '_bigger.')
			};
		} catch (err) {
			throw classifyXError(err, 'read');
		}
	}

	async createPost(payload: CreatePostPayload): Promise<{ id: string }> {
		try {
			const res = await this.client.v2.tweet(buildPostBody(payload) as SendTweetV2Params);
			return { id: res.data.id };
		} catch (err) {
			throw classifyXError(err, 'post');
		}
	}

	async uploadMedia(data: Buffer, mime: string, kind: MediaKind): Promise<string> {
		const category =
			kind === 'image' ? 'tweet_image' : kind === 'gif' ? 'tweet_gif' : 'tweet_video';
		try {
			return await this.client.v2.uploadMedia(
				data,
				{ media_type: mime as never, media_category: category },
				CHUNK_BYTES
			);
		} catch (err) {
			throw classifyXError(err, 'media');
		}
	}

	async setAltText(mediaId: string, text: string): Promise<void> {
		try {
			await this.client.v2.createMediaMetadata(mediaId, {
				alt_text: { text: text.slice(0, 1000) }
			});
		} catch (err) {
			throw classifyXError(err, 'media');
		}
	}

	async recentPosts(xUserId: string, sinceMs: number): Promise<RecentPost[]> {
		try {
			const res = await this.client.v2.get<{
				data?: { id: string; text: string; created_at?: string; note_tweet?: { text: string } }[];
			}>(`users/${xUserId}/tweets`, {
				max_results: 10,
				start_time: new Date(sinceMs).toISOString(),
				'tweet.fields': 'created_at,note_tweet'
			});
			return (res.data ?? []).map((t) => ({
				id: t.id,
				text: t.note_tweet?.text ?? t.text,
				createdAt: t.created_at ? Date.parse(t.created_at) : Date.now()
			}));
		} catch (err) {
			throw classifyXError(err, 'read');
		}
	}
}
