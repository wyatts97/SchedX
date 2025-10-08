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
