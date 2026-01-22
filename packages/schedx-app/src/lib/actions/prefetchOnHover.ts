/**
 * Prefetch on hover action for navigation links
 * Preloads linked pages when user hovers over links to improve perceived performance
 */

import { preloadData } from '$app/navigation';
import { browser } from '$app/environment';

interface PrefetchOptions {
	delay?: number; // Delay in ms before prefetching (to avoid prefetching on quick mouse movements)
	prefetchImages?: boolean; // Also prefetch images on the target page
}

const DEFAULT_OPTIONS: PrefetchOptions = {
	delay: 100,
	prefetchImages: false
};

const prefetchedUrls = new Set<string>();

export function prefetchOnHover(node: HTMLAnchorElement, options: PrefetchOptions = {}) {
	if (!browser) return { destroy: () => {} };

	const opts = { ...DEFAULT_OPTIONS, ...options };
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let isHovering = false;

	function getHref(): string | null {
		const href = node.getAttribute('href');
		if (!href) return null;
		
		// Only prefetch internal links
		if (href.startsWith('http') && !href.startsWith(window.location.origin)) {
			return null;
		}
		
		// Skip hash links and external protocols
		if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
			return null;
		}
		
		return href;
	}

	async function prefetch() {
		const href = getHref();
		if (!href || prefetchedUrls.has(href)) return;

		try {
			// Mark as prefetched to avoid duplicate requests
			prefetchedUrls.add(href);

			// Use SvelteKit's preloadData for internal routes
			await preloadData(href);

			// Optionally prefetch images
			if (opts.prefetchImages) {
				prefetchImages(href);
			}
		} catch (error) {
			// Remove from set so it can be retried
			prefetchedUrls.delete(href);
			console.debug('Prefetch failed for:', href, error);
		}
	}

	function prefetchImages(href: string) {
		// This is a simple implementation that prefetches the page HTML
		// and extracts image URLs to preload
		fetch(href)
			.then(res => res.text())
			.then(html => {
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, 'text/html');
				const images = doc.querySelectorAll('img[src]');
				
				images.forEach(img => {
					const src = img.getAttribute('src');
					if (src && !src.startsWith('data:')) {
						const link = document.createElement('link');
						link.rel = 'prefetch';
						link.as = 'image';
						link.href = src;
						document.head.appendChild(link);
					}
				});
			})
			.catch(() => {});
	}

	function handleMouseEnter() {
		isHovering = true;
		
		// Delay prefetch to avoid unnecessary requests on quick mouse movements
		timeoutId = setTimeout(() => {
			if (isHovering) {
				prefetch();
			}
		}, opts.delay);
	}

	function handleMouseLeave() {
		isHovering = false;
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	}

	function handleFocus() {
		// Also prefetch on focus for keyboard navigation
		prefetch();
	}

	// Add touch support for mobile
	function handleTouchStart() {
		prefetch();
	}

	node.addEventListener('mouseenter', handleMouseEnter);
	node.addEventListener('mouseleave', handleMouseLeave);
	node.addEventListener('focus', handleFocus);
	node.addEventListener('touchstart', handleTouchStart, { passive: true });

	return {
		update(newOptions: PrefetchOptions) {
			Object.assign(opts, newOptions);
		},
		destroy() {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			node.removeEventListener('mouseenter', handleMouseEnter);
			node.removeEventListener('mouseleave', handleMouseLeave);
			node.removeEventListener('focus', handleFocus);
			node.removeEventListener('touchstart', handleTouchStart);
		}
	};
}

/**
 * Clear the prefetched URLs cache
 * Useful when navigation state changes significantly
 */
export function clearPrefetchCache(): void {
	prefetchedUrls.clear();
}

/**
 * Check if a URL has been prefetched
 */
export function isPrefetched(url: string): boolean {
	return prefetchedUrls.has(url);
}
