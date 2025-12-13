/**
 * Image Optimization Service
 * Handles image compression, WebP conversion, and thumbnail generation
 * Uses sharp for high-performance image processing
 */

import { existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
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

// Cache for tracking optimized images
const optimizedCache = new Map<string, OptimizationResult>();

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
 * Optimize image using sharp - resize, compress, and convert to WebP
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

		// Skip non-image files and GIFs (animated)
		const isImage = mimeType.startsWith('image/') && mimeType !== 'image/gif';
		if (!isImage) {
			return null;
		}

		const originalSize = statSync(filepath).size;
		const thumbnailsDir = getThumbnailsDir();
		const optimizedDir = getOptimizedDir();
		const baseName = path.basename(filename, path.extname(filename));
		const ext = path.extname(filename);

		// Initialize sharp with the original image
		const image = sharp(filepath);
		const metadata = await image.metadata();

		// Generate WebP version (typically 25-35% smaller)
		let webpUrl: string | null = null;
		let optimizedSize = originalSize;
		const webpPath = path.join(optimizedDir, `${baseName}.webp`);
		
		try {
			await sharp(filepath)
				.webp({ quality: 85, effort: 4 })
				.toFile(webpPath);
			
			webpUrl = `/uploads/optimized/${baseName}.webp`;
			optimizedSize = statSync(webpPath).size;
			logger.debug(`WebP conversion: ${filename} -> ${optimizedSize} bytes (${Math.round((1 - optimizedSize/originalSize) * 100)}% smaller)`);
		} catch (webpError) {
			logger.warn(`WebP conversion failed for ${filename}, using original`);
		}

		// Generate thumbnails at different sizes
		const thumbnailUrls: Record<ThumbnailSize, string> = {
			small: `/uploads/thumbnails/${baseName}_small.webp`,
			medium: `/uploads/thumbnails/${baseName}_medium.webp`,
			large: `/uploads/thumbnails/${baseName}_large.webp`
		};

		for (const [sizeName, dimensions] of Object.entries(THUMBNAIL_SIZES)) {
			const thumbnailPath = path.join(thumbnailsDir, `${baseName}_${sizeName}.webp`);
			
			if (!existsSync(thumbnailPath)) {
				try {
					await sharp(filepath)
						.resize(dimensions.width, dimensions.height, {
							fit: 'cover',
							position: 'center'
						})
						.webp({ quality: 80 })
						.toFile(thumbnailPath);
				} catch (thumbError) {
					// Fallback: create thumbnail in original format
					const fallbackPath = path.join(thumbnailsDir, `${baseName}_${sizeName}${ext}`);
					await sharp(filepath)
						.resize(dimensions.width, dimensions.height, {
							fit: 'cover',
							position: 'center'
						})
						.toFile(fallbackPath);
					thumbnailUrls[sizeName as ThumbnailSize] = `/uploads/thumbnails/${baseName}_${sizeName}${ext}`;
				}
			}
		}

		const savedBytes = originalSize - optimizedSize;
		const savedPercent = Math.round((savedBytes / originalSize) * 100);

		const result: OptimizationResult = {
			originalUrl: `/uploads/${filename}`,
			optimizedUrl: webpUrl || `/uploads/${filename}`,
			webpUrl,
			thumbnailUrls,
			originalSize,
			optimizedSize,
			savedBytes,
			savedPercent
		};

		// Cache the result
		optimizedCache.set(filename, result);
		
		logger.info(`Image optimized: ${filename} | Original: ${(originalSize/1024).toFixed(1)}KB | WebP: ${(optimizedSize/1024).toFixed(1)}KB | Saved: ${savedPercent}%`);
		return result;
	} catch (error) {
		logger.error(`Failed to optimize image ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
 * Clean up thumbnails and optimized versions for a deleted image
 */
export function cleanupThumbnails(filename: string): void {
	try {
		const thumbnailsDir = getThumbnailsDir();
		const optimizedDir = getOptimizedDir();
		const baseName = path.basename(filename, path.extname(filename));
		const ext = path.extname(filename);
		
		// Clean up WebP thumbnails
		for (const size of Object.keys(THUMBNAIL_SIZES)) {
			// Try WebP version first
			const webpPath = path.join(thumbnailsDir, `${baseName}_${size}.webp`);
			if (existsSync(webpPath)) {
				unlinkSync(webpPath);
			}
			// Also try original format version
			const origPath = path.join(thumbnailsDir, `${baseName}_${size}${ext}`);
			if (existsSync(origPath)) {
				unlinkSync(origPath);
			}
		}
		
		// Clean up optimized WebP version
		const webpOptimized = path.join(optimizedDir, `${baseName}.webp`);
		if (existsSync(webpOptimized)) {
			unlinkSync(webpOptimized);
		}
		
		// Remove from cache
		optimizedCache.delete(filename);
		
		logger.debug(`Cleaned up optimized files for ${filename}`);
	} catch (error) {
		logger.error(`Failed to cleanup optimized files for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
