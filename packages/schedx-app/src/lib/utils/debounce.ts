/**
 * Debounce Utility
 * Prevents excessive function calls during rapid user input
 */

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified wait time has elapsed since the last call.
 * 
 * @param fn - Function to debounce
 * @param wait - Milliseconds to wait before executing (default: 300ms)
 * @param immediate - If true, trigger on leading edge instead of trailing
 * @returns Debounced function with cancel method
 * 
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   fetch(`/api/search?q=${query}`);
 * }, 300);
 * 
 * // In input handler:
 * onInput={(e) => debouncedSearch(e.target.value)}
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	wait: number = 300,
	immediate: boolean = false
): T & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Parameters<T> | null = null;

	const debounced = function (this: any, ...args: Parameters<T>) {
		lastArgs = args;
		const context = this;

		const later = () => {
			timeoutId = null;
			if (!immediate && lastArgs) {
				fn.apply(context, lastArgs);
			}
		};

		const callNow = immediate && !timeoutId;

		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(later, wait);

		if (callNow) {
			fn.apply(context, args);
		}
	} as T & { cancel: () => void };

	debounced.cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
		lastArgs = null;
	};

	return debounced;
}

/**
 * Creates a throttled version of a function that only executes
 * at most once per specified time period.
 * 
 * @param fn - Function to throttle
 * @param limit - Minimum milliseconds between executions
 * @returns Throttled function
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	limit: number
): T {
	let inThrottle = false;
	let lastArgs: Parameters<T> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const context = this;

		if (!inThrottle) {
			fn.apply(context, args);
			inThrottle = true;

			setTimeout(() => {
				inThrottle = false;
				if (lastArgs) {
					fn.apply(context, lastArgs);
					lastArgs = null;
				}
			}, limit);
		} else {
			lastArgs = args;
		}
	} as T;
}

/**
 * Svelte-friendly debounced value store creator
 * Returns a reactive value that updates after debounce delay
 * 
 * @example
 * <script>
 *   import { createDebouncedValue } from '$lib/utils/debounce';
 *   
 *   let searchQuery = '';
 *   const debouncedQuery = createDebouncedValue(() => searchQuery, 300);
 *   
 *   $: if ($debouncedQuery) {
 *     fetchResults($debouncedQuery);
 *   }
 * </script>
 * 
 * <input bind:value={searchQuery} />
 */
export function createDebouncedStore<T>(
	initialValue: T,
	wait: number = 300
): {
	set: (value: T) => void;
	subscribe: (fn: (value: T) => void) => () => void;
	get: () => T;
} {
	let currentValue = initialValue;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	const subscribers = new Set<(value: T) => void>();

	const notify = () => {
		for (const subscriber of subscribers) {
			subscriber(currentValue);
		}
	};

	return {
		set: (value: T) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			timeoutId = setTimeout(() => {
				currentValue = value;
				notify();
			}, wait);
		},
		subscribe: (fn: (value: T) => void) => {
			subscribers.add(fn);
			fn(currentValue); // Immediate call with current value
			return () => subscribers.delete(fn);
		},
		get: () => currentValue
	};
}

// Preset debounce times for common use cases
export const DEBOUNCE_TIMES = {
	search: 300,      // Search/filter input
	resize: 150,      // Window resize
	scroll: 100,      // Scroll events
	input: 200,       // General input
	api: 500,         // API calls
	save: 1000        // Auto-save
} as const;
