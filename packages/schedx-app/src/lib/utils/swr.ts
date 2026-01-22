/**
 * Stale-While-Revalidate (SWR) pattern implementation
 * Returns cached data immediately while fetching fresh data in the background
 */

import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

interface SWROptions {
	maxAge?: number; // Maximum age in milliseconds before data is considered stale
	dedupingInterval?: number; // Interval in ms to dedupe requests
	revalidateOnFocus?: boolean; // Revalidate when window regains focus
	revalidateOnReconnect?: boolean; // Revalidate when network reconnects
}

interface SWRStore<T> {
	subscribe: Writable<{
		data: T | null;
		error: Error | null;
		isLoading: boolean;
		isValidating: boolean;
	}>['subscribe'];
	mutate: (data?: T) => Promise<void>;
	revalidate: () => Promise<void>;
}

const cache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

const DEFAULT_OPTIONS: SWROptions = {
	maxAge: 5 * 60 * 1000, // 5 minutes
	dedupingInterval: 2000, // 2 seconds
	revalidateOnFocus: true,
	revalidateOnReconnect: true
};

/**
 * Create an SWR store for a given key and fetcher function
 */
export function createSWR<T>(
	key: string,
	fetcher: () => Promise<T>,
	options: SWROptions = {}
): SWRStore<T> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	
	const store = writable<{
		data: T | null;
		error: Error | null;
		isLoading: boolean;
		isValidating: boolean;
	}>({
		data: null,
		error: null,
		isLoading: true,
		isValidating: false
	});

	let lastFetchTime = 0;

	async function fetchData(isRevalidation = false): Promise<T> {
		const now = Date.now();
		
		// Dedupe requests within the interval
		if (pendingRequests.has(key)) {
			return pendingRequests.get(key)!;
		}
		
		// Check if we should dedupe based on last fetch time
		if (now - lastFetchTime < opts.dedupingInterval!) {
			const cached = cache.get(key);
			if (cached) {
				return cached.data;
			}
		}

		const fetchPromise = (async () => {
			try {
				store.update(s => ({ ...s, isValidating: true, isLoading: !isRevalidation && !s.data }));
				
				const data = await fetcher();
				
				// Update cache
				cache.set(key, { data, timestamp: now });
				lastFetchTime = now;
				
				// Update store
				store.set({
					data,
					error: null,
					isLoading: false,
					isValidating: false
				});
				
				return data;
			} catch (error) {
				store.update(s => ({
					...s,
					error: error instanceof Error ? error : new Error(String(error)),
					isLoading: false,
					isValidating: false
				}));
				throw error;
			} finally {
				pendingRequests.delete(key);
			}
		})();

		pendingRequests.set(key, fetchPromise);
		return fetchPromise;
	}

	async function revalidate(): Promise<void> {
		await fetchData(true);
	}

	async function mutate(newData?: T): Promise<void> {
		if (newData !== undefined) {
			// Optimistic update
			cache.set(key, { data: newData, timestamp: Date.now() });
			store.update(s => ({ ...s, data: newData }));
		}
		// Revalidate in background
		await revalidate();
	}

	// Initial fetch
	if (browser) {
		// Check cache first
		const cached = cache.get(key);
		if (cached) {
			const isStale = Date.now() - cached.timestamp > opts.maxAge!;
			
			// Return stale data immediately
			store.set({
				data: cached.data,
				error: null,
				isLoading: false,
				isValidating: isStale
			});
			
			// Revalidate if stale
			if (isStale) {
				fetchData(true).catch(() => {});
			}
		} else {
			// No cache, fetch fresh data
			fetchData().catch(() => {});
		}

		// Set up revalidation on focus
		if (opts.revalidateOnFocus) {
			const handleFocus = () => {
				const cached = cache.get(key);
				if (!cached || Date.now() - cached.timestamp > opts.maxAge!) {
					revalidate().catch(() => {});
				}
			};
			
			window.addEventListener('focus', handleFocus);
		}

		// Set up revalidation on reconnect
		if (opts.revalidateOnReconnect) {
			const handleOnline = () => {
				revalidate().catch(() => {});
			};
			
			window.addEventListener('online', handleOnline);
		}
	}

	return {
		subscribe: store.subscribe,
		mutate,
		revalidate
	};
}

/**
 * Clear cached data for a specific key or all keys
 */
export function clearCache(key?: string): void {
	if (key) {
		cache.delete(key);
	} else {
		cache.clear();
	}
}

/**
 * Preload data into cache
 */
export function preloadCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}
