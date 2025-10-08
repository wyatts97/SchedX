// Client-safe configuration constants
// These values are fetched dynamically from the server to match environment variables

import logger from './logger';

// Default fallback values (used if API is not available)
const DEFAULT_CONFIG = {
	MAX_UPLOAD_SIZE: 5 * 1024 * 1024, // 5MB in bytes
	MAX_MEDIA_FILES: 4,
	ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
	ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mov', 'video/avi', 'video/webm'],
	MAX_AVATAR_SIZE: 5 * 1024 * 1024, // 5MB in bytes
	ALLOWED_AVATAR_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
} as const;

// Function to fetch dynamic config from server
async function fetchConfig() {
	try {
		const response = await fetch('/api/config');
		if (response.ok) {
			const data = await response.json();
			return data.config;
		}
	} catch (error) {
		logger.warn('Failed to fetch config from server, using defaults');
	}
	return DEFAULT_CONFIG;
}

// Export the config fetching function and default values
export { fetchConfig, DEFAULT_CONFIG };

// For backward compatibility, export a promise that resolves to the config
export const CLIENT_CONFIG = fetchConfig();
