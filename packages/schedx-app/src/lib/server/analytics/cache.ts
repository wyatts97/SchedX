/**
 * Analytics Cache Module
 * 
 * Centralized in-memory cache for analytics data
 * Provides cache invalidation for data updates
 */

// Simple in-memory cache (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data if available and not expired
 */
export function getCachedData(key: string): any | null {
	const cached = cache.get(key);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.data;
	}
	return null;
}

/**
 * Set data in cache
 */
export function setCachedData(key: string, data: any): void {
	cache.set(key, {
		data,
		timestamp: Date.now()
	});

	// Clean old cache entries (simple cleanup)
	if (cache.size > 100) {
		const now = Date.now();
		for (const [cacheKey, value] of cache.entries()) {
			if (now - value.timestamp > CACHE_DURATION) {
				cache.delete(cacheKey);
			}
		}
	}
}

/**
 * Clear analytics cache for a specific user or all users
 * Called after data updates (e.g., sync, import)
 */
export function clearAnalyticsCache(userId?: string): void {
	if (userId) {
		// Clear all cache entries for this user
		for (const key of cache.keys()) {
			if (key.includes(userId)) {
				cache.delete(key);
			}
		}
	} else {
		// Clear entire cache
		cache.clear();
	}
}

/**
 * Get cache duration in milliseconds
 */
export function getCacheDuration(): number {
	return CACHE_DURATION;
}
