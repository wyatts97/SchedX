import { describe, expect, it } from 'vitest';
import { textStats, normalizeForMatch, hasUrl } from '#lib/shared/text.js';
import { estimateCost } from '#lib/shared/cost.js';
import { validateAttachmentSet } from '#lib/shared/media-rules.js';
import { DEFAULT_RATES } from '#lib/shared/types.js';
import { fromLocal, toLocalInput, fromLocalInput } from '#lib/shared/time.js';

describe('textStats', () => {
	it('weights URLs as 23 characters like X does', () => {
		expect(textStats('hi https://example.com/a/very/long/path/that/goes/on').weighted).toBe(26);
	});
	it('flags posts over 280 unless premium', () => {
		const long = 'a'.repeat(300);
		expect(textStats(long).over).toBe(true);
		expect(textStats(long, true).over).toBe(false);
	});
});

describe('estimateCost', () => {
	it('charges the URL rate for posts containing links', () => {
		const cost = estimateCost(
			[
				{ text: 'plain post', media: [] },
				{ text: 'see https://example.com', media: [] }
			],
			DEFAULT_RATES
		);
		expect(cost.posts).toBe(1);
		expect(cost.postsWithUrl).toBe(1);
		expect(cost.total).toBeCloseTo(0.215);
	});
	it('charges alt text only for images and GIFs', () => {
		const cost = estimateCost(
			[
				{
					text: 'x',
					media: [
						{ kind: 'image', altText: 'a cat' },
						{ kind: 'video', altText: 'ignored' }
					]
				}
			],
			DEFAULT_RATES
		);
		expect(cost.altTexts).toBe(1);
		expect(cost.total).toBeCloseTo(0.02);
	});
	it('detects bare domains as links', () => {
		expect(hasUrl('visit example.com today')).toBe(true);
		expect(hasUrl('no links here')).toBe(false);
	});
});

describe('normalizeForMatch', () => {
	it('matches text after X rewrites links to t.co', () => {
		expect(normalizeForMatch('Read  this https://example.com/post')).toBe(
			normalizeForMatch('Read this https://t.co/AbC123')
		);
	});
});

describe('validateAttachmentSet', () => {
	it('allows up to four images', () => {
		expect(validateAttachmentSet(['image', 'image', 'image', 'image'])).toBeNull();
		expect(validateAttachmentSet(['image', 'image', 'image', 'image', 'image'])).not.toBeNull();
	});
	it('requires GIF/video to be alone', () => {
		expect(validateAttachmentSet(['video'])).toBeNull();
		expect(validateAttachmentSet(['video', 'image'])).not.toBeNull();
		expect(validateAttachmentSet(['gif', 'gif'])).not.toBeNull();
	});
});

describe('time helpers', () => {
	it('round-trips local input values across a DST change', () => {
		const tz = 'America/New_York';
		const at = fromLocal('2026-03-08', 9 * 60, tz); // DST starts that morning
		expect(toLocalInput(at, tz)).toBe('2026-03-08T09:00');
		expect(fromLocalInput('2026-03-08T09:00', tz)).toBe(at);
		expect(new Date(at).toISOString()).toBe('2026-03-08T13:00:00.000Z');
	});
});
