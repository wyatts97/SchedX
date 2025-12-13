/**
 * Pre-computed Analytics Cache Service
 * Caches expensive analytics calculations to reduce database load
 */

import { getDbInstance } from '../db';
import logger from '../logger';

interface CachedAnalytics {
	data: any;
	computedAt: number;
	expiresAt: number;
}

// In-memory cache for analytics
const analyticsCache = new Map<string, CachedAnalytics>();

// Cache TTLs (in milliseconds)
const CACHE_TTLS = {
	dashboard: 60 * 1000,           // 1 minute for dashboard stats
	overview: 5 * 60 * 1000,        // 5 minutes for overview
	engagement: 15 * 60 * 1000,     // 15 minutes for engagement metrics
	contentMix: 30 * 60 * 1000,     // 30 minutes for content distribution
	hashtags: 60 * 60 * 1000        // 1 hour for hashtag analysis
} as const;

type CacheType = keyof typeof CACHE_TTLS;

/**
 * Generate cache key for analytics
 */
function getCacheKey(type: CacheType, userId: string, params?: Record<string, any>): string {
	const paramStr = params ? JSON.stringify(params) : '';
	return `${type}:${userId}:${paramStr}`;
}

/**
 * Check if cached value is still valid
 */
function isValidCache(cached: CachedAnalytics | undefined): boolean {
	if (!cached) return false;
	return Date.now() < cached.expiresAt;
}

/**
 * Get cached analytics or compute if expired
 */
export async function getCachedAnalytics<T>(
	type: CacheType,
	userId: string,
	computeFn: () => Promise<T>,
	params?: Record<string, any>
): Promise<T> {
	const cacheKey = getCacheKey(type, userId, params);
	const cached = analyticsCache.get(cacheKey);

	if (isValidCache(cached)) {
		logger.debug(`Analytics cache hit: ${type} for user ${userId}`);
		return cached!.data as T;
	}

	logger.debug(`Analytics cache miss: ${type} for user ${userId}, computing...`);
	const startTime = Date.now();

	try {
		const data = await computeFn();
		const now = Date.now();

		analyticsCache.set(cacheKey, {
			data,
			computedAt: now,
			expiresAt: now + CACHE_TTLS[type]
		});

		logger.debug(`Analytics computed in ${Date.now() - startTime}ms: ${type}`);
		return data;
	} catch (error) {
		logger.error(`Failed to compute analytics ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		throw error;
	}
}

/**
 * Invalidate cache for a specific user
 */
export function invalidateUserCache(userId: string, type?: CacheType): void {
	const prefix = type ? `${type}:${userId}:` : `:${userId}:`;
	
	for (const key of analyticsCache.keys()) {
		if (key.includes(prefix)) {
			analyticsCache.delete(key);
		}
	}
	
	logger.debug(`Invalidated analytics cache for user ${userId}${type ? ` (${type})` : ''}`);
}

/**
 * Invalidate all analytics caches
 */
export function invalidateAllCaches(): void {
	analyticsCache.clear();
	logger.debug('All analytics caches invalidated');
}

/**
 * Pre-compute and cache common analytics during low-traffic periods
 */
export async function precomputeAnalytics(userId: string): Promise<void> {
	const db = getDbInstance();
	
	try {
		// Pre-compute dashboard stats
		await getCachedAnalytics('dashboard', userId, async () => {
			const tweets = await db.getAllTweets(userId);
			return {
				totalTweets: tweets.length,
				postedTweets: tweets.filter((t: any) => t.status?.toUpperCase() === 'POSTED').length,
				scheduledTweets: tweets.filter((t: any) => t.status?.toUpperCase() === 'SCHEDULED').length,
				draftTweets: tweets.filter((t: any) => t.status?.toUpperCase() === 'DRAFT').length,
				failedTweets: tweets.filter((t: any) => t.status?.toUpperCase() === 'FAILED').length
			};
		});

		logger.debug(`Pre-computed analytics for user ${userId}`);
	} catch (error) {
		logger.error(`Failed to pre-compute analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
	totalEntries: number;
	validEntries: number;
	expiredEntries: number;
	memoryUsage: string;
} {
	let validCount = 0;
	let expiredCount = 0;
	const now = Date.now();

	for (const cached of analyticsCache.values()) {
		if (now < cached.expiresAt) {
			validCount++;
		} else {
			expiredCount++;
		}
	}

	// Rough memory estimate
	const memoryBytes = JSON.stringify([...analyticsCache.values()]).length;
	const memoryKB = (memoryBytes / 1024).toFixed(2);

	return {
		totalEntries: analyticsCache.size,
		validEntries: validCount,
		expiredEntries: expiredCount,
		memoryUsage: `${memoryKB} KB`
	};
}

/**
 * Cleanup expired cache entries
 */
export function cleanupExpiredCache(): number {
	const now = Date.now();
	let cleaned = 0;

	for (const [key, cached] of analyticsCache.entries()) {
		if (now >= cached.expiresAt) {
			analyticsCache.delete(key);
			cleaned++;
		}
	}

	if (cleaned > 0) {
		logger.debug(`Cleaned up ${cleaned} expired analytics cache entries`);
	}

	return cleaned;
}

// Auto-cleanup every 5 minutes
setInterval(cleanupExpiredCache, 5 * 60 * 1000);
