import { getDbInstance } from './db';
import type { TwitterApp, UserAccount } from '@schedx/shared-lib/types/types';
import { log } from './logger';
import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';

export const TWITTER_SCOPES = [
	'tweet.read',
	'tweet.write',
	'users.read',
	'offline.access',
	'media.write'
] as const;

export interface TwitterAuthState {
	csrf: string;
	twitterAppId: string;
	codeVerifier: string;
	timestamp: number;
}

export interface TwitterAuthError {
	error: string;
	error_description?: string;
	state?: string;
}

function base64url(input: Buffer) {
	return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePKCEPair(): { codeVerifier: string; codeChallenge: string } {
	const codeVerifier = base64url(crypto.randomBytes(32));
	const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
	return { codeVerifier, codeChallenge };
}

export class TwitterAuthService {
	private static instance: TwitterAuthService;

	private constructor() {}

	public static getInstance(): TwitterAuthService {
		if (!TwitterAuthService.instance) {
			TwitterAuthService.instance = new TwitterAuthService();
		}
		return TwitterAuthService.instance;
	}

	/**
	 * Generate PKCE code verifier and challenge
	 */
	private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
		return generatePKCEPair();
	}

	/**
	 * Build Twitter OAuth2 authorization URL with PKCE
	 * Follows OAuth 2.0 standard: state should be a simple random string
	 */
	public buildAuthUrl(app: TwitterApp, state: TwitterAuthState): string {
		const { codeVerifier, codeChallenge } = this.generatePKCE();
		state.codeVerifier = codeVerifier;
		state.timestamp = Date.now();

		// Use CSRF token as the state parameter (OAuth 2.0 standard)
		const stateParam = state.csrf;

		log.info('Building Twitter OAuth URL', {
			csrf: stateParam,
			twitterAppId: state.twitterAppId,
			appId: app.id,
			appName: app.name,
			clientIdPrefix: app.clientId?.substring(0, 15) + '...',
			callbackUrl: app.callbackUrl,
			hasCodeVerifier: !!state.codeVerifier,
			appIdMatchesState: app.id === state.twitterAppId
		});

		const params = new URLSearchParams({
			response_type: 'code',
			client_id: app.clientId,
			redirect_uri: app.callbackUrl,
			scope: [...TWITTER_SCOPES].join(' '),
			state: stateParam,
			code_challenge: codeChallenge,
			code_challenge_method: 's256',
			force_login: 'true' // Force Twitter to show account selection
		});

		// First, create a logout URL to clear Twitter session, then redirect to auth
	// This ensures users can select which account to use
	const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

		log.info('Twitter OAuth URL built', {
			stateParam,
			authUrlLength: authUrl.length,
			authUrlStart: authUrl.substring(0, 100) + '...'
		});

		return authUrl;
	}

	/**
	 * Validate OAuth state and extract information
	 * Follows OAuth 2.0 standard: validate state matches stored CSRF token
	 */
	public validateState(stateStr: string, expectedState: string): TwitterAuthState {
		try {
			// Twitter might URL-encode the state parameter, so decode it
			const decodedStateStr = decodeURIComponent(stateStr);

			// Parse the expected state (stored in cookie as JSON)
			const expected = JSON.parse(expectedState) as TwitterAuthState;

			log.info('State validation details', {
				originalState: stateStr,
				receivedState: decodedStateStr,
				expectedCsrf: expected.csrf,
				stateMatches: decodedStateStr === expected.csrf,
				timestamp: expected.timestamp,
				currentTime: Date.now(),
				timeDiff: Date.now() - expected.timestamp
			});

			// Validate CSRF token (OAuth 2.0 state parameter)
			if (decodedStateStr !== expected.csrf) {
				log.error('CSRF token mismatch', {
					originalState: stateStr,
					received: decodedStateStr,
					expected: expected.csrf,
					receivedLength: decodedStateStr.length,
					expectedLength: expected.csrf.length
				});
				throw new Error('Invalid CSRF token');
			}

			// Validate timestamp (10 minute expiry)
			const now = Date.now();
			const maxAge = 10 * 60 * 1000;
			if (now - expected.timestamp > maxAge) {
				log.error('OAuth state expired', {
					timestamp: expected.timestamp,
					currentTime: now,
					timeDiff: now - expected.timestamp,
					maxAge
				});
				throw new Error('OAuth state expired');
			}

			return expected;
		} catch (error) {
			log.error('State validation failed:', {
				error: error instanceof Error ? error.message : String(error),
				originalState: stateStr,
				stateStrDecoded: decodeURIComponent(stateStr),
				expectedState: expectedState.substring(0, 100) + '...'
			});
			throw new Error('Invalid OAuth state');
		}
	}

	/**
	 * Exchange authorization code for access token
	 */
	public async exchangeCodeForToken(
		app: TwitterApp,
		code: string,
		codeVerifier: string
	): Promise<{
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
		scope: string[];
	}> {
		try {
			const client = new TwitterApi({
				clientId: app.clientId,
				clientSecret: app.clientSecret
			});
			const {
				client: loggedClient,
				accessToken,
				refreshToken,
				expiresIn,
				scope
			} = await client.loginWithOAuth2({
				code,
				codeVerifier,
				redirectUri: app.callbackUrl
			});
			return {
				accessToken,
				refreshToken: refreshToken || '',
				expiresIn: expiresIn || 0,
				scope:
					typeof scope === 'string'
						? (scope as string).split(' ')
						: Array.isArray(scope)
							? scope
							: []
			};
		} catch (error) {
			log.error('Token exchange failed:', { error, appId: app.id });
			throw new Error(
				`Failed to exchange code for token: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Fetch Twitter user information with retry logic for rate limiting
	 */
	public async fetchUserInfo(
		accessToken: string,
		retryCount = 0
	): Promise<{
		id: string;
		username: string;
		name: string;
		profile_image_url: string;
	}> {
		try {
			const client = new TwitterApi(accessToken);
			const userInfo = await client.v2.me({
				'user.fields': ['name', 'username', 'profile_image_url']
			});
			if (!userInfo.data) {
				throw new Error('Failed to fetch user information');
			}
			return {
				id: userInfo.data.id,
				username: userInfo.data.username,
				name: userInfo.data.name || '',
				profile_image_url: userInfo.data.profile_image_url || ''
			};
		} catch (error: any) {
			// Handle rate limiting with retry logic
			if (error?.code === 429 && retryCount < 3) {
				const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
				log.error('Rate limit exceeded when fetching user info, retrying:', {
					error: error.message,
					rateLimit: error.rateLimit,
					retryCount: retryCount + 1,
					delay
				});

				// Wait before retrying
				await new Promise((resolve) => setTimeout(resolve, delay));

				// Retry with incremented count
				return this.fetchUserInfo(accessToken, retryCount + 1);
			}

			// Handle rate limiting specifically (final attempt)
			if (error?.code === 429) {
				log.error('Rate limit exceeded when fetching user info (final attempt):', {
					error: error.message,
					rateLimit: error.rateLimit,
					headers: error.headers
				});
				throw new Error('Twitter API rate limit exceeded. Please try again in a few minutes.');
			}

			log.error('Failed to fetch user info:', { error });
			throw new Error(
				`Failed to fetch user information: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Save user account to database
	 */
	public async saveUserAccount(userInfo: any, tokens: any, twitterAppId: string, userId: string): Promise<string> {
		const db = getDbInstance();
		const now = new Date();
		const userAccount: UserAccount = {
			userId,
			username: userInfo.username,
			displayName: userInfo.name,
			profileImage: userInfo.profile_image_url,
			provider: 'twitter',
			providerAccountId: userInfo.id,
			access_token: tokens.accessToken,
			refresh_token: tokens.refreshToken,
			expires_at: Math.floor(Date.now() / 1000) + tokens.expiresIn,
			expires_in: tokens.expiresIn,
			token_type: 'bearer',
			scope: tokens.scope.join(' '),
			createdAt: now,
			updatedAt: now,
			twitterAppId,
			isDefault: false
		};

		log.info('Saving user account to database', {
			username: userAccount.username,
			providerAccountId: userAccount.providerAccountId,
			twitterAppId: userAccount.twitterAppId,
			hasAccessToken: !!userAccount.access_token,
			hasRefreshToken: !!userAccount.refresh_token,
			expiresAt: userAccount.expires_at
		});

		const accountId = await db.saveUserAccount(userAccount);

		// Verify the account was actually saved
		const accountExists = await db.verifyAccountExists(userAccount.providerAccountId);
		if (!accountExists) {
			log.error('Account verification failed after save', {
				accountId,
				providerAccountId: userAccount.providerAccountId,
				username: userAccount.username
			});
			throw new Error('Failed to verify account was saved');
		}

		log.info('User account saved and verified successfully', {
			accountId,
			username: userAccount.username,
			providerAccountId: userAccount.providerAccountId,
			verified: accountExists
		});

		return accountId;
	}

	/**
	 * Validate Twitter app configuration
	 */
	public validateAppConfig(app: TwitterApp): void {
		if (!app.clientId || !app.clientSecret || !app.callbackUrl) {
			throw new Error('Invalid Twitter app configuration');
		}

		// Validate OAuth 1.0a credentials if provided
		if (app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret) {
			log.info('OAuth 1.0a credentials provided - media uploads will be supported');
		} else {
			log.warn('OAuth 1.0a credentials not provided - media uploads will not be supported');
		}

		try {
			const url = new URL(app.callbackUrl);
			log.info('Validating Twitter app config', {
				clientId: app.clientId ? 'SET' : 'NOT SET',
				clientSecret: app.clientSecret ? 'SET' : 'NOT SET',
				consumerKey: app.consumerKey ? 'SET' : 'NOT SET',
				consumerSecret: app.consumerSecret ? 'SET' : 'NOT SET',
				accessToken: app.accessToken ? 'SET' : 'NOT SET',
				accessTokenSecret: app.accessTokenSecret ? 'SET' : 'NOT SET',
				callbackUrl: app.callbackUrl,
				hasOAuth1Credentials: !!(
					app.consumerKey &&
					app.consumerSecret &&
					app.accessToken &&
					app.accessTokenSecret
				)
			});
		} catch (error) {
			throw new Error('Invalid callback URL format');
		}
	}

	/**
	 * Check if OAuth 1.0a credentials are complete for media uploads
	 */
	public hasOAuth1Credentials(app: TwitterApp): boolean {
		return !!(app.consumerKey && app.consumerSecret && app.accessToken && app.accessTokenSecret);
	}

	/**
	 * Check if user account exists and is valid
	 * @param providerAccountId - Twitter user ID
	 * @param twitterAppId - Optional Twitter app ID to check for specific app+account combination
	 */
	public async checkExistingAccount(providerAccountId: string, twitterAppId?: string): Promise<UserAccount | null> {
		const db = getDbInstance();
		const accounts = await db.getAllUserAccounts();
		
		if (twitterAppId) {
			// Check for specific combination of account + app
			return accounts.find((account) => 
				account.providerAccountId === providerAccountId && 
				account.twitterAppId === twitterAppId
			) || null;
		}
		
		// Check for any account with this provider ID
		return accounts.find((account) => account.providerAccountId === providerAccountId) || null;
	}

	/**
	 * Refresh access token using refresh token
	 */
	public async refreshAccessToken(
		app: TwitterApp,
		refreshToken: string
	): Promise<{
		accessToken: string;
		refreshToken: string;
		expiresIn: number;
	}> {
		try {
			const client = new TwitterApi({
				clientId: app.clientId,
				clientSecret: app.clientSecret
			});
			const {
				accessToken,
				refreshToken: newRefreshToken,
				expiresIn
			} = await client.refreshOAuth2Token(refreshToken);
			return {
				accessToken,
				refreshToken: newRefreshToken || refreshToken,
				expiresIn: expiresIn || 0
			};
		} catch (error) {
			log.error('Token refresh failed:', { error, appId: app.id });
			throw new Error(
				`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Revoke access token
	 */
	public async revokeAccessToken(app: TwitterApp, accessToken: string): Promise<boolean> {
		try {
			const client = new TwitterApi({
				clientId: app.clientId,
				clientSecret: app.clientSecret
			});
			await client.revokeOAuth2Token(accessToken);
			return true;
		} catch (error) {
			log.error('Token revocation failed:', { error, appId: app.id });
			return false;
		}
	}

	/**
	 * Get authenticated Twitter client with automatic token refresh
	 * This is the recommended way to get a Twitter client for API calls
	 * 
	 * @param account - User account with access token
	 * @param twitterApp - Twitter app configuration
	 * @returns Authenticated TwitterApi client with fresh token
	 */
	public async getAuthenticatedClient(
		account: any,
		twitterApp: TwitterApp
	): Promise<{ client: any; accessToken: string }> {
		const now = Math.floor(Date.now() / 1000);
		let accessToken = account.access_token;

		// Check if token needs refresh (expires within 5 minutes)
		if (account.expires_at && now >= account.expires_at - 300) {
			try {
				log.info('Refreshing access token', { 
					accountId: account.id,
					expiresAt: account.expires_at,
					now 
				});

				const {
					accessToken: newAccessToken,
					refreshToken: newRefreshToken,
					expiresIn
				} = await this.refreshAccessToken(twitterApp, account.refresh_token);

				// Update the account in the database
				const db = getDbInstance();
				const updatedAccount = {
					...account,
					access_token: newAccessToken,
					refresh_token: newRefreshToken || account.refresh_token,
					expires_at: Math.floor(Date.now() / 1000) + expiresIn,
					updatedAt: new Date()
				};

				await db.saveUserAccount(updatedAccount);
				accessToken = newAccessToken;
				
				log.info('Successfully refreshed access token', { accountId: account.id });
			} catch (refreshError) {
				log.error('Failed to refresh access token:', {
					accountId: account.id,
					error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
				});
				// Continue with existing token - it might still work
			}
		}

		const client = new TwitterApi(accessToken);
		return { client, accessToken };
	}
}
