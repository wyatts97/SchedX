<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import BiggerPicture from 'bigger-picture';
	import 'bigger-picture/css';

	interface MediaItem {
		id: string;
		url: string;
		type: 'photo' | 'gif' | 'video';
		filename: string;
		width?: number;
		height?: number;
	}

	export let mediaItems: MediaItem[] = [];
	
	let bp: ReturnType<typeof BiggerPicture> | null = null;

	onMount(() => {
		if (!browser) return;

		// Initialize BiggerPicture
		bp = BiggerPicture({
			target: document.body,
		});

		return () => {
			// Cleanup if needed
			bp = null;
		};
	});

	/**
	 * Preload image and get its natural dimensions
	 */
	function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				resolve({ width: img.naturalWidth, height: img.naturalHeight });
			};
			img.onerror = () => {
				// Fallback to square aspect ratio if image fails to load
				resolve({ width: 1000, height: 1000 });
			};
			img.src = url;
		});
	}

	/**
	 * Opens the lightbox at a specific media item
	 * @param index - Index of the media item to display
	 * @param element - Optional DOM element for animation origin
	 */
	export async function open(index: number = 0, element?: HTMLElement) {
		if (!bp || !browser) return;

		// Convert media items to bigger-picture format, preloading images to get dimensions
		const items = await Promise.all(mediaItems.map(async (media) => {
			const item: any = {
				element: element, // For animation
				alt: media.filename,
				caption: media.filename,
			};

			// Handle different media types
			if (media.type === 'video') {
				// Video: use sources array for HTML5 video
				item.sources = [
					{
						src: media.url,
						type: getVideoMimeType(media.url),
					},
				];
				// Set dimensions if provided, otherwise use reasonable defaults for video
				item.width = media.width || 1280;
				item.height = media.height || 720;
				// Add video attributes
				item.attr = {
					controls: true,
					autoplay: true,
					playsinline: true,
				};
			} else {
				// Image or GIF: preload to get actual dimensions
				item.img = media.url;
				item.thumb = media.url;
				
				// Use provided dimensions or preload image to get natural dimensions
				if (media.width && media.height) {
					item.width = media.width;
					item.height = media.height;
				} else {
					// Preload image to get natural dimensions
					const dims = await getImageDimensions(media.url);
					item.width = dims.width;
					item.height = dims.height;
				}
			}

			return item;
		}));

		// Open lightbox
		bp.open({
			items,
			position: index,
			intro: 'fadeup',
			scale: 0.95,
		});
	}

	/**
	 * Get MIME type for video based on file extension
	 */
	function getVideoMimeType(url: string): string {
		const ext = url.split('.').pop()?.toLowerCase();
		switch (ext) {
			case 'mp4':
				return 'video/mp4';
			case 'webm':
				return 'video/webm';
			case 'ogg':
			case 'ogv':
				return 'video/ogg';
			case 'mov':
				return 'video/quicktime';
			default:
				return 'video/mp4'; // Default fallback
		}
	}

	/**
	 * Close the lightbox
	 */
	export function close() {
		if (bp) {
			bp.close();
		}
	}
</script>

<!-- This component has no template - it's a programmatic lightbox controller -->
