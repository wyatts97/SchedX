import type { MediaInfo } from '#lib/shared/compose.js';

export interface EditorMedia extends MediaInfo {
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
