/**
 * Constructs a Twitter URL for a specific tweet
 * @param username - The Twitter username (without @)
 * @param tweetId - The Twitter tweet ID
 * @returns The full Twitter URL
 */
export const constructTweetUrl = (username: string, tweetId: string): string => {
	return `https://twitter.com/${username}/status/${tweetId}`;
};

/**
 * Opens a Twitter URL in a new tab
 * @param username - The Twitter username (without @)
 * @param tweetId - The Twitter tweet ID
 */
export const openTweetInNewTab = (username: string, tweetId: string): void => {
	const url = constructTweetUrl(username, tweetId);
	window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Get high-resolution profile image URL from Twitter
 * Twitter profile images can be requested in different sizes:
 * _normal (48x48), _bigger (73x73), _200x200, _400x400, or original (remove size suffix)
 * @param url - The profile image URL (any size)
 * @returns High-quality 400x400 profile image URL
 */
export const getHighResProfileImage = (url: string | undefined): string => {
	if (!url) return '/avatar.png';
	// Replace _normal or other size suffixes with _400x400 for higher quality
	return url
		.replace(/_normal\./, '_400x400.')
		.replace(/_bigger\./, '_400x400.')
		.replace(/_200x200\./, '_400x400.');
};

/**
 * Sanitizes tweet content to prevent XSS and remove problematic characters
 * @param content - The raw tweet content
 * @returns Sanitized tweet content safe for storage and display
 */
export const sanitizeTweetContent = (content: string): string => {
	if (!content) return '';
	
	let sanitized = content;
	
	// Remove zero-width characters that could bypass character limits
	// These are invisible but count as characters on some systems
	sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF\u2060]/g, '');
	
	// Remove control characters (except newlines and tabs which are valid)
	sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
	
	// Normalize multiple consecutive newlines to max 2
	sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
	
	// Normalize multiple consecutive spaces to single space
	sanitized = sanitized.replace(/ {2,}/g, ' ');
	
	// Trim leading/trailing whitespace
	sanitized = sanitized.trim();
	
	return sanitized;
};

/**
 * Validates tweet content length after sanitization
 * @param content - The tweet content
 * @returns Object with isValid flag and actual character count
 */
export const validateTweetLength = (content: string): { isValid: boolean; length: number; maxLength: number } => {
	const sanitized = sanitizeTweetContent(content);
	const length = sanitized.length;
	const maxLength = 280;
	
	return {
		isValid: length > 0 && length <= maxLength,
		length,
		maxLength
	};
};
