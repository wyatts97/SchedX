import type { MediaKind, PollInput } from '#lib/shared/types.js';

export interface TweetMedia {
	url: string;
	thumbUrl: string;
	kind: MediaKind;
	alt: string;
}

export interface TweetItem {
	text: string;
	media: TweetMedia[];
	poll?: PollInput | null;
}

export interface TweetAuthor {
	displayName: string;
	username: string;
	avatarUrl: string | null;
}

/** Splits post text into plain runs and X-highlighted tokens (links, @mentions, #hashtags). */
export function tokenize(text: string): { text: string; highlight: boolean }[] {
	const out: { text: string; highlight: boolean }[] = [];
	const re = /(https?:\/\/[^\s]+|(?<![\w@#])[@#][\p{L}\p{N}_]+)/gu;
	let last = 0;
	for (const m of text.matchAll(re)) {
		if (m.index > last) out.push({ text: text.slice(last, m.index), highlight: false });
		out.push({ text: m[0], highlight: true });
		last = m.index + m[0].length;
	}
	if (last < text.length) out.push({ text: text.slice(last), highlight: false });
	return out;
}
