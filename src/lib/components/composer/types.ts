import type { MediaInfo } from '#lib/shared/compose.js';

/**
 * One attachment in the composer. `id` is unique per attachment (drag-and-drop needs that, and
 * the same file can be attached to two posts of a thread); `mediaId` is the library item.
 */
export interface EditorMedia extends MediaInfo {
	mediaId: string;
	alt: string;
}

export interface EditorItem {
	key: string;
	text: string;
	media: EditorMedia[];
	poll: { options: string[]; durationMinutes: number } | null;
	uploads: { name: string; progress: number }[];
}

export function newItem(text = ''): EditorItem {
	return { key: crypto.randomUUID(), text, media: [], poll: null, uploads: [] };
}

export function attach(media: MediaInfo, alt = media.altText): EditorMedia {
	return { ...media, id: crypto.randomUUID(), mediaId: media.id, alt };
}
