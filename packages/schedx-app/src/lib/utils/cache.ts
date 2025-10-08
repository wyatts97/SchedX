import logger from '$lib/logger';

interface CacheItem<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

interface CacheOptions {
	ttl?: number; // Time to live in milliseconds
	maxSize?: number; // Maximum number of items in cache
	onEvict?: (key: string, value: any) => void; // Callback when item is evicted
}

class Cache<T = any> {
	private cache = new Map<string, CacheItem<T>>();
	private accessOrder = new Map<string, number>(); // For LRU tracking
	private accessCounter = 0;
	private options: Required<CacheOptions>;

	constructor(options: CacheOptions = {}) {
		this.options = {
			ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
			maxSize: options.maxSize || 100,
			onEvict: options.onEvict || (() => {})
		};
	}

	set(key: string, value: T, customTtl?: number): void {
		try {
			const ttl = customTtl || this.options.ttl;
			const item: CacheItem<T> = {
				data: value,
				timestamp: Date.now(),
				ttl
			};

			// If cache is at max size, remove least recently used item
			if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
				this.evictLRU();
			}

			this.cache.set(key, item);
			this.accessOrder.set(key, ++this.accessCounter);

			logger.debug('Cache set', { key, ttl, cacheSize: this.cache.size });
		} catch (error) {
			logger.error('Cache set error', {
				key,
				error: error instanceof Error ? error.message : error
			});
		}
	}

	get(key: string): T | null {
		try {
			const item = this.cache.get(key);

			if (!item) {
				logger.debug('Cache miss', { key });
				return null;
			}

			// Check if item has expired
			if (Date.now() - item.timestamp > item.ttl) {
				this.delete(key);
				logger.debug('Cache expired', { key });
				return null;
			}

			// Update access order for LRU
			this.accessOrder.set(key, ++this.accessCounter);

			logger.debug('Cache hit', { key });
			return item.data;
		} catch (error) {
			logger.error('Cache get error', {
				key,
				error: error instanceof Error ? error.message : error
			});
			return null;
		}
	}

	delete(key: string): boolean {
		try {
			const item = this.cache.get(key);
			if (item) {
				this.options.onEvict(key, item.data);
			}

			this.cache.delete(key);
			this.accessOrder.delete(key);

			logger.debug('Cache delete', { key });
			return true;
		} catch (error) {
			logger.error('Cache delete error', {
				key,
				error: error instanceof Error ? error.message : error
			});
			return false;
		}
	}

	clear(): void {
		try {
			// Call onEvict for all items
			for (const [key, item] of this.cache.entries()) {
				this.options.onEvict(key, item.data);
			}

			this.cache.clear();
			this.accessOrder.clear();
			this.accessCounter = 0;

			logger.debug('Cache cleared');
		} catch (error) {
			logger.error('Cache clear error', { error: error instanceof Error ? error.message : error });
		}
	}

	has(key: string): boolean {
		const item = this.cache.get(key);
		if (!item) return false;

		// Check if expired
		if (Date.now() - item.timestamp > item.ttl) {
			this.delete(key);
			return false;
		}

		return true;
	}

	size(): number {
		return this.cache.size;
	}

	keys(): string[] {
		return Array.from(this.cache.keys());
	}

	// Get cache statistics
	getStats() {
		const now = Date.now();
		let expired = 0;
		let valid = 0;

		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > item.ttl) {
				expired++;
			} else {
				valid++;
			}
		}

		return {
			total: this.cache.size,
			valid,
			expired,
			maxSize: this.options.maxSize,
			defaultTtl: this.options.ttl
		};
	}

	// Clean up expired items
	cleanup(): number {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, item] of this.cache.entries()) {
			if (now - item.timestamp > item.ttl) {
				this.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			logger.debug('Cache cleanup completed', { itemsRemoved: cleaned });
		}

		return cleaned;
	}

	private evictLRU(): void {
		let oldestKey = '';
		let oldestAccess = Infinity;

		for (const [key, accessTime] of this.accessOrder.entries()) {
			if (accessTime < oldestAccess) {
				oldestAccess = accessTime;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.delete(oldestKey);
			logger.debug('LRU eviction', { evictedKey: oldestKey });
		}
	}
}

// Create singleton instances for different types of data
export const apiCache = new Cache({
	ttl: 5 * 60 * 1000, // 5 minutes
	maxSize: 50,
	onEvict: (key, value) => {
		logger.debug('API cache eviction', { key });
	}
});

export const userCache = new Cache({
	ttl: 15 * 60 * 1000, // 15 minutes
	maxSize: 20,
	onEvict: (key, value) => {
		logger.debug('User cache eviction', { key });
	}
});

export const staticCache = new Cache({
	ttl: 60 * 60 * 1000, // 1 hour
	maxSize: 100,
	onEvict: (key, value) => {
		logger.debug('Static cache eviction', { key });
	}
});

// Utility function to create cache keys
export const createCacheKey = (...parts: (string | number | boolean)[]): string => {
	return parts.map((part) => String(part)).join(':');
};

// Utility function for cached API calls
export async function cachedFetch<T>(
	key: string,
	fetchFn: () => Promise<T>,
	cache: Cache<T> = apiCache,
	ttl?: number
): Promise<T> {
	// Try to get from cache first
	const cached = cache.get(key);
	if (cached !== null) {
		return cached;
	}

	try {
		// Fetch fresh data
		const data = await fetchFn();

		// Store in cache
		cache.set(key, data, ttl);

		return data;
	} catch (error) {
		logger.error('Cached fetch error', {
			key,
			error: error instanceof Error ? error.message : error
		});
		throw error;
	}
}

// Auto cleanup interval (runs every 10 minutes)
if (typeof window !== 'undefined') {
	setInterval(
		() => {
			apiCache.cleanup();
			userCache.cleanup();
			staticCache.cleanup();
		},
		10 * 60 * 1000
	);
}

export { Cache };
export default Cache;
