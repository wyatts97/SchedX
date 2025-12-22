/**
 * Video Thumbnail Service
 * Generates thumbnails from video files using fluent-ffmpeg
 */

import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import logger from './logger';

// Get the uploads directory path
function getUploadsDir(): string {
	return process.env.DOCKER === 'true'
		? '/app/packages/schedx-app/uploads'
		: path.join(process.cwd(), 'uploads');
}

// Get the video thumbnails directory path
function getVideoThumbnailsDir(): string {
	const thumbnailsDir = path.join(getUploadsDir(), 'video-thumbnails');
	
	if (!existsSync(thumbnailsDir)) {
		mkdirSync(thumbnailsDir, { recursive: true });
	}
	
	return thumbnailsDir;
}

export interface VideoThumbnailResult {
	thumbnailUrl: string;
	thumbnailPath: string;
}

/**
 * Generate a thumbnail from a video file
 * @param videoPath - Absolute path to the video file
 * @param filename - Original filename (used to generate thumbnail name)
 * @returns Promise with thumbnail URL and path
 */
export async function generateVideoThumbnail(
	videoPath: string,
	filename: string
): Promise<VideoThumbnailResult | null> {
	try {
		const thumbnailsDir = getVideoThumbnailsDir();
		const baseName = path.basename(filename, path.extname(filename));
		const thumbnailFilename = `${baseName}_thumb.jpg`;
		const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
		const thumbnailUrl = `/uploads/video-thumbnails/${thumbnailFilename}`;

		// Check if thumbnail already exists
		if (existsSync(thumbnailPath)) {
			logger.debug(`Video thumbnail already exists: ${thumbnailFilename}`);
			return { thumbnailUrl, thumbnailPath };
		}

		// Generate thumbnail using ffmpeg
		await new Promise<void>((resolve, reject) => {
			ffmpeg(videoPath)
				.on('error', (err) => {
					logger.error(`Error generating video thumbnail: ${err.message}`);
					reject(err);
				})
				.on('end', () => {
					logger.info(`Video thumbnail generated: ${thumbnailFilename}`);
					resolve();
				})
				.screenshots({
					count: 1,
					folder: thumbnailsDir,
					filename: thumbnailFilename,
					size: '400x?', // 400px width, maintain aspect ratio
					timestamps: ['0'] // Take screenshot at first frame (0 seconds) to match Twitter's behavior
				});
		});

		return { thumbnailUrl, thumbnailPath };
	} catch (error) {
		logger.error(`Failed to generate video thumbnail for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return null;
	}
}

/**
 * Get video thumbnail URL for a media item
 * Falls back to null if thumbnail doesn't exist
 */
export function getVideoThumbnailUrl(originalUrl: string): string | null {
	const filename = path.basename(originalUrl);
	const baseName = path.basename(filename, path.extname(filename));
	const thumbnailFilename = `${baseName}_thumb.jpg`;
	const thumbnailsDir = getVideoThumbnailsDir();
	const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
	
	if (existsSync(thumbnailPath)) {
		return `/uploads/video-thumbnails/${thumbnailFilename}`;
	}
	
	return null;
}

/**
 * Clean up video thumbnail for a deleted video
 */
export function cleanupVideoThumbnail(filename: string): void {
	try {
		const thumbnailsDir = getVideoThumbnailsDir();
		const baseName = path.basename(filename, path.extname(filename));
		const thumbnailPath = path.join(thumbnailsDir, `${baseName}_thumb.jpg`);
		
		if (existsSync(thumbnailPath)) {
			const { unlinkSync } = require('fs');
			unlinkSync(thumbnailPath);
			logger.debug(`Cleaned up video thumbnail for ${filename}`);
		}
	} catch (error) {
		logger.error(`Failed to cleanup video thumbnail for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
