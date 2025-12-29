/**
 * Image Optimization Service
 * NOTE: Image optimization removed to reduce Docker image size
 * Images are now handled client-side in the browser
 */

import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';
import logger from './logger';

// Thumbnail sizes for different use cases
export const THUMBNAIL_SIZES = {
	small: { width: 150, height: 150 },   // Gallery grid
	medium: { width: 400, height: 400 },  // Preview cards
	large: { width: 800, height: 800 }    // Detail view
} as const;

type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

interface OptimizationResult {
	originalUrl: string;
	optimizedUrl: string;
	webpUrl: string | null;
	thumbnailUrls: Record<ThumbnailSize, string>;
	originalSize: number;
	optimizedSize: number;
	savedBytes: number;
	savedPercent: number;
}

// LRU Cache for tracking optimized images with automatic eviction
// Max 500 entries, 1 hour TTL to prevent unbounded memory growth
const optimizedCache = new LRUCache<string, OptimizationResult>({
	max: 500,
	ttl: 1000 * 60 * 60, // 1 hour
	maxSize: 50 * 1024 * 1024, // 50MB max cache size
	sizeCalculation: (value) => {
		// Estimate size based on stored data
		return JSON.stringify(value).length;
	},
	dispose: (value, key) => {
		logger.debug({ filename: key }, 'Evicting image optimization result from cache');
	}
});

/**
 * Get the uploads directory path
 */
function getUploadsDir(): string {
	return process.env.DOCKER === 'true'
		? '/app/packages/schedx-app/uploads'
		: path.join(process.cwd(), 'uploads');
}

/**
 * Get the thumbnails directory path
 */
function getThumbnailsDir(): string {
	const thumbnailsDir = path.join(getUploadsDir(), 'thumbnails');
	
	if (!existsSync(thumbnailsDir)) {
		mkdirSync(thumbnailsDir, { recursive: true });
	}
	
	return thumbnailsDir;
}

/**
 * Get the optimized images directory path
 */
function getOptimizedDir(): string {
	const optimizedDir = path.join(getUploadsDir(), 'optimized');
	
	if (!existsSync(optimizedDir)) {
		mkdirSync(optimizedDir, { recursive: true });
	}
	
	return optimizedDir;
}

/**
 * Check if an image has already been optimized
 */
export function isOptimized(filename: string): boolean {
	return optimizedCache.has(filename);
}

/**
 * Get cached optimization result
 */
export function getCachedOptimization(filename: string): OptimizationResult | null {
	return optimizedCache.get(filename) || null;
}

/**
 * No-op image optimization - returns original file info
 * Image optimization removed to reduce Docker image size (~50MB saved)
 * Images are handled client-side in the browser
 */
export async function optimizeImage(
	filepath: string,
	filename: string,
	mimeType: string
): Promise<OptimizationResult | null> {
	try {
		// Check cache first
		if (optimizedCache.has(filename)) {
			return optimizedCache.get(filename)!;
		}

		// Skip non-image files
		const isImage = mimeType.startsWith('image/');
		if (!isImage) {
			return null;
		}

		const originalSize = statSync(filepath).size;
		const baseName = path.basename(filename, path.extname(filename));

		// Return original file info without optimization
		const result: OptimizationResult = {
			originalUrl: `/uploads/${filename}`,
			optimizedUrl: `/uploads/${filename}`,
			webpUrl: null,
			thumbnailUrls: {
				small: `/uploads/${filename}`,
				medium: `/uploads/${filename}`,
				large: `/uploads/${filename}`
			},
			originalSize,
			optimizedSize: originalSize,
			savedBytes: 0,
			savedPercent: 0
		};

		// Cache the result
		optimizedCache.set(filename, result);
		
		logger.debug(`Image uploaded (no server-side optimization): ${filename} | Size: ${(originalSize/1024).toFixed(1)}KB`);
		return result;
	} catch (error) {
		logger.error(`Failed to process image ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return null;
	}
}

/**
 * Get thumbnail URL for a media item
 * Falls back to original if thumbnail doesn't exist
 */
export function getThumbnailUrl(
	originalUrl: string,
	size: ThumbnailSize = 'medium'
): string {
	const filename = path.basename(originalUrl);
	const cached = optimizedCache.get(filename);
	
	if (cached && cached.thumbnailUrls[size]) {
		return cached.thumbnailUrls[size];
	}
	
	// Return original if no thumbnail
	return originalUrl;
}

/**
 * Clean up cache entry for deleted image
 * No thumbnails to clean since optimization is disabled
 */
export function cleanupThumbnails(filename: string): void {
	try {
		// Remove from cache
		optimizedCache.delete(filename);
		
		logger.debug(`Removed cache entry for ${filename}`);
	} catch (error) {
		logger.error(`Failed to cleanup cache for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Get optimization statistics
 */
export function getOptimizationStats(): {
	totalOptimized: number;
	totalSavedBytes: number;
	avgSavedPercent: number;
} {
	let totalSavedBytes = 0;
	let totalSavedPercent = 0;
	
	for (const result of optimizedCache.values()) {
		totalSavedBytes += result.savedBytes;
		totalSavedPercent += result.savedPercent;
	}
	
	return {
		totalOptimized: optimizedCache.size,
		totalSavedBytes,
		avgSavedPercent: optimizedCache.size > 0 ? totalSavedPercent / optimizedCache.size : 0
	};
}
