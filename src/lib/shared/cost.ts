import { hasUrl } from './text.js';
import type { MediaKind, Rates } from './types.js';

export interface CostItemInput {
	text: string;
	media: { kind: MediaKind; altText?: string }[];
}

export interface CostBreakdown {
	total: number;
	posts: number;
	postsWithUrl: number;
	altTexts: number;
}

/** Media metadata (alt text) is only sent for images and GIFs. */
export function altTextBillable(m: { kind: MediaKind; altText?: string }): boolean {
	return m.kind !== 'video' && !!m.altText?.trim();
}

export function estimateCost(items: CostItemInput[], rates: Rates): CostBreakdown {
	let total = 0;
	let posts = 0;
	let postsWithUrl = 0;
	let altTexts = 0;
	for (const item of items) {
		if (hasUrl(item.text)) {
			postsWithUrl++;
			total += rates.postWithUrl;
		} else {
			posts++;
			total += rates.post;
		}
		for (const m of item.media) {
			if (altTextBillable(m)) {
				altTexts++;
				total += rates.mediaMetadata;
			}
		}
	}
	return { total: round(total), posts, postsWithUrl, altTexts };
}

export function round(n: number): number {
	return Math.round(n * 10_000) / 10_000;
}

export function formatUsd(n: number): string {
	if (n === 0) return '$0';
	if (n < 0.01) return `$${n.toFixed(3)}`;
	return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}
