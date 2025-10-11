import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

/**
 * Validate that a twitterAccountId belongs to the authenticated user
 */
export async function validateAccountOwnership(
	accountId: string,
	userId: string
): Promise<{ valid: boolean; account?: any; error?: string }> {
	try {
		const db = getDbInstance();
		const allAccounts = await (db as any).getAllUserAccounts();
		
		// Find account by database ID
		const account = allAccounts.find((acc: any) => acc.id === accountId);
		
		if (!account) {
			log.warn('Account not found', { accountId, userId });
			return { valid: false, error: 'Account not found' };
		}
		
		// Verify account belongs to user
		if (account.userId !== userId) {
			log.warn('Account ownership mismatch', { 
				accountId, 
				userId, 
				accountUserId: account.userId 
			});
			return { valid: false, error: 'You do not have permission to use this account' };
		}
		
		return { valid: true, account };
	} catch (error) {
		log.error('Error validating account ownership', { error, accountId, userId });
		return { valid: false, error: 'Failed to validate account' };
	}
}

/**
 * Validate that a Twitter app exists and is accessible
 */
export async function validateTwitterApp(
	twitterAppId: string
): Promise<{ valid: boolean; app?: any; error?: string }> {
	try {
		const db = getDbInstance();
		const app = await db.getTwitterApp(twitterAppId);
		
		if (!app) {
			log.warn('Twitter app not found', { twitterAppId });
			return { valid: false, error: 'Twitter app not found' };
		}
		
		// Verify app has required OAuth2 credentials
		if (!app.clientId || !app.clientSecret) {
			log.warn('Twitter app missing OAuth2 credentials', { twitterAppId });
			return { valid: false, error: 'Twitter app is not properly configured' };
		}
		
		return { valid: true, app };
	} catch (error) {
		log.error('Error validating Twitter app', { error, twitterAppId });
		return { valid: false, error: 'Failed to validate Twitter app' };
	}
}

/**
 * Validate scheduled date is in the future
 */
export function validateScheduledDate(
	scheduledDate: Date
): { valid: boolean; error?: string } {
	const now = new Date();
	
	if (scheduledDate <= now) {
		return { valid: false, error: 'Scheduled date must be in the future' };
	}
	
	// Check if date is too far in the future (1 year)
	const oneYearFromNow = new Date();
	oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
	
	if (scheduledDate > oneYearFromNow) {
		return { valid: false, error: 'Scheduled date cannot be more than 1 year in the future' };
	}
	
	return { valid: true };
}

/**
 * Validate tweet content
 */
export function validateTweetContent(
	content: string
): { valid: boolean; error?: string } {
	if (!content || content.trim() === '') {
		return { valid: false, error: 'Tweet content is required' };
	}
	
	if (content.length > 280) {
		return { valid: false, error: 'Tweet content cannot exceed 280 characters' };
	}
	
	return { valid: true };
}

/**
 * Validate thread tweets
 */
export function validateThreadTweets(
	tweets: any[]
): { valid: boolean; error?: string } {
	if (!tweets || !Array.isArray(tweets)) {
		return { valid: false, error: 'Tweets must be an array' };
	}
	
	if (tweets.length < 2) {
		return { valid: false, error: 'Thread must have at least 2 tweets' };
	}
	
	if (tweets.length > 25) {
		return { valid: false, error: 'Thread cannot exceed 25 tweets' };
	}
	
	// Validate each tweet
	for (let i = 0; i < tweets.length; i++) {
		const tweet = tweets[i];
		
		if (!tweet.content || typeof tweet.content !== 'string') {
			return { valid: false, error: `Tweet ${i + 1} must have content` };
		}
		
		if (tweet.content.length > 280) {
			return { valid: false, error: `Tweet ${i + 1} exceeds 280 characters` };
		}
	}
	
	return { valid: true };
}
