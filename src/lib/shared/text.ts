import twitterText from 'twitter-text';

export const STANDARD_LIMIT = 280;
export const PREMIUM_LIMIT = 25_000;

export interface TextStats {
	/** Weighted length as X counts it (URLs = 23, most emoji/CJK = 2). */
	weighted: number;
	limit: number;
	remaining: number;
	over: boolean;
	urls: string[];
}

export function textStats(text: string, premium = false): TextStats {
	const limit = premium ? PREMIUM_LIMIT : STANDARD_LIMIT;
	const parsed = twitterText.parseTweet(text);
	const weighted = parsed.weightedLength;
	return {
		weighted,
		limit,
		remaining: limit - weighted,
		over: weighted > limit,
		urls: extractUrls(text)
	};
}

export function extractUrls(text: string): string[] {
	return twitterText.extractUrls(text);
}

export function hasUrl(text: string): boolean {
	return extractUrls(text).length > 0;
}

/**
 * Normalises post text for "did this already get posted?" comparisons. X rewrites links to
 * t.co and may trim whitespace, so links and whitespace runs are collapsed.
 */
export function normalizeForMatch(text: string): string {
	let out = text;
	for (const url of extractUrls(text)) out = out.split(url).join(' ');
	out = out.replace(/https?:\/\/t\.co\/\S+/g, ' ');
	return out.replace(/\s+/g, ' ').trim().toLowerCase();
}
