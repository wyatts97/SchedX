import type { MediaKind } from './types.js';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const GIF_MIMES = ['image/gif'] as const;
export const VIDEO_MIMES = ['video/mp4', 'video/quicktime'] as const;
export const ACCEPTED_MIMES = [...IMAGE_MIMES, ...GIF_MIMES, ...VIDEO_MIMES];

const MB = 1024 * 1024;

/** X limits per media type (images are re-encoded server-side to fit). */
export const X_LIMITS = {
	image: 5 * MB,
	gif: 15 * MB,
	video: 512 * MB
} satisfies Record<MediaKind, number>;

export function kindForMime(mime: string): MediaKind | null {
	if ((IMAGE_MIMES as readonly string[]).includes(mime)) return 'image';
	if ((GIF_MIMES as readonly string[]).includes(mime)) return 'gif';
	if ((VIDEO_MIMES as readonly string[]).includes(mime)) return 'video';
	return null;
}

/**
 * X allows up to 4 images, or exactly 1 GIF, or exactly 1 video per post.
 * Returns an error message, or null when the combination is valid.
 */
export function validateAttachmentSet(kinds: MediaKind[]): string | null {
	if (kinds.length === 0) return null;
	const images = kinds.filter((k) => k === 'image').length;
	if (images === kinds.length) return images > 4 ? 'A post can have at most 4 images.' : null;
	if (kinds.length > 1) return 'A GIF or video must be the only attachment in a post.';
	return null;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
	return `${(bytes / MB).toFixed(1)} MB`;
}
