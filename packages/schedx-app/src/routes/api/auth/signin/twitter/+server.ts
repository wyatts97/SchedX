import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import {
	TwitterAuthService,
	type TwitterAuthState,
	type TwitterAuthError
} from '$lib/server/twitterAuth';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

const twitterAuth = TwitterAuthService.getInstance();

// GET: Handles both starting OAuth and the callback
export const GET: RequestHandler = async ({ url, cookies }) => {
	const twitterAppId = url.searchParams.get('twitterAppId');
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const error_description = url.searchParams.get('error_description');

	log.info('Twitter OAuth endpoint called', {
		hasTwitterAppId: !!twitterAppId,
		hasState: !!state,
		hasCode: !!code,
		hasError: !!error,
		url: url.toString()
	});

	try {
		// 1. Start OAuth flow if twitterAppId is present
		if (twitterAppId && !state && !code) {
			await handleOAuthStart(twitterAppId, cookies);
			return new Response(); // This line should never be reached due to redirect
		}

		// 2. Handle OAuth callback from Twitter
		if (state && code) {
			await handleOAuthCallback(state, code, cookies);
			return new Response(); // This line should never be reached due to redirect
		}

		// 3. Handle OAuth error from Twitter
		if (error) {
			handleOAuthError(error, error_description || undefined, state || undefined);
			return new Response(); // This line should never be reached due to redirect
		}

		// 4. Fallback: missing params
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		// Check if this is a redirect (which is expected behavior)
		if (error && typeof error === 'object' && 'status' in error && (error.status === 302 || error.status === 303)) {
			// This is a successful redirect, not an error
			throw error; // Re-throw the redirect
		}

		log.error('Twitter OAuth error:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			url: url.toString()
		});
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		throw redirect(
			303,
			`/accounts?error=${encodeURIComponent('Authentication failed: ' + errorMessage)}`
		);
	}
};

/**
 * Handle OAuth flow initiation
 */
async function handleOAuthStart(twitterAppId: string, cookies: any) {
	// Validate admin session
	const adminSession = cookies.get('admin_session');
	log.info('Twitter OAuth start - Session check', {
		hasSession: !!adminSession,
		sessionLength: adminSession?.length || 0,
		twitterAppId
	});

	if (!adminSession || adminSession.trim() === '') {
		log.error('Twitter OAuth error: Missing admin session');
		throw redirect(303, '/login?error=session');
	}

	const db = getDbInstance();

	// Verify session exists and is valid
	const session = await db.getSession(adminSession);
	log.info('Twitter OAuth start - Session validation', {
		sessionFound: !!session,
		sessionUsername: session?.data?.user?.username,
		sessionUserId: session?.data?.user?.id
	});

	if (!session) {
		log.error('Twitter OAuth error: Session not found or expired');
		throw redirect(303, '/login?error=session');
	}

	// Verify admin user exists and session belongs to admin
	const user = await (db as any).getAdminUserByUsername('admin');
	log.info('Twitter OAuth start - Admin user check', {
		userFound: !!user,
		userId: user?.id,
		username: user?.username
	});

	if (!user) {
		log.error('Twitter OAuth error: Admin user not found');
		throw redirect(303, '/login?error=session');
	}

	// Validate that the session belongs to the admin user
	if (session.data.user.username !== 'admin') {
		log.error('Twitter OAuth error: Session does not belong to admin user', {
			sessionUsername: session.data.user.username,
			expectedUsername: 'admin'
		});
		throw redirect(303, '/login?error=session');
	}

	// Validate Twitter app exists
	const app = await db.getTwitterApp(twitterAppId);
	log.info('Twitter OAuth start - App validation', {
		appFound: !!app,
		appId: app?.id,
		appName: app?.name
	});

	if (!app) {
		throw new Error('Invalid Twitter app configuration');
	}

	// Validate app configuration
	twitterAuth.validateAppConfig(app);

	// Generate CSRF token and state
	const csrf = crypto.randomUUID();
	const state: TwitterAuthState = {
		csrf,
		twitterAppId,
		codeVerifier: '', // Will be set by buildAuthUrl
		timestamp: Date.now()
	};

	// Build authorization URL with PKCE (this updates state with codeVerifier)
	const authUrl = twitterAuth.buildAuthUrl(app, state);

	// Store updated state in secure cookie (after codeVerifier is added)
	// Disable 'secure' flag for local network (HTTP) deployments
	const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
	cookies.set('twitter_auth_state', JSON.stringify(state), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
		maxAge: 600 // 10 minutes
	});

	// Also set CSRF token as a separate cookie for additional security
	cookies.set('twitter_auth_csrf', state.csrf, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
		maxAge: 600 // 10 minutes
	});

	// Also store a backup of the admin session in the OAuth state for recovery
	const oauthStateWithSession = {
		...state,
		adminSession: adminSession // Store session ID in state for recovery
	};

	const oauthStateStr = JSON.stringify(oauthStateWithSession);
	cookies.set('twitter_oauth_backup', oauthStateStr, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
		maxAge: 600 // 10 minutes
	});

	log.info('Starting Twitter OAuth flow', {
		twitterAppId,
		csrf: csrf.substring(0, 8) + '...',
		callbackUrl: app.callbackUrl,
		authUrl: authUrl.substring(0, 100) + '...' // Log first 100 chars of auth URL
	});

	throw redirect(302, authUrl);
}

/**
 * Handle OAuth callback from Twitter
 */
async function handleOAuthCallback(state: string, code: string, cookies: any) {
	log.info('Handling OAuth callback', {
		hasState: !!state,
		hasCode: !!code,
		hasExpectedState: !!cookies.get('twitter_oauth_state'),
		stateLength: state?.length || 0,
		codeLength: code?.length || 0
	});

	try {
		// Validate admin session FIRST - this is critical
		const adminSession = cookies.get('admin_session');
		log.info('OAuth callback - Session check', {
			hasSession: !!adminSession,
			sessionLength: adminSession?.length || 0
		});

		const db = getDbInstance();
		let session = null;
		let user = null;

		if (adminSession && adminSession.trim() !== '') {
			// Try to validate the main session first
			session = await db.getSession(adminSession);
			if (session && session.data.user.username === 'admin') {
				user = await (db as any).getAdminUserByUsername('admin');
			}
		}

		// If main session failed, try backup session
		if (!session || !user) {
			log.info('OAuth callback - Main session failed, trying backup session');
			const backupState = cookies.get('twitter_oauth_backup');
			if (backupState) {
				try {
					const backupData = JSON.parse(backupState);
					const backupSession = await db.getSession(backupData.adminSession);
					if (backupSession && backupSession.data.user.username === 'admin') {
						session = backupSession;
						user = await (db as any).getAdminUserByUsername('admin');
						log.info('OAuth callback - Backup session successful');
					}
				} catch (error) {
					log.error('OAuth callback - Backup session failed', { error });
				}
			}
		}

		if (!session) {
			log.error('OAuth callback - No valid session found (main or backup)');
			throw redirect(303, '/login?error=session_expired');
		}

		if (!user) {
			log.error('OAuth callback - Admin user not found');
			throw redirect(303, '/login?error=admin_not_found');
		}

		log.info('OAuth callback - Session validation successful', {
			sessionFound: !!session,
			sessionUsername: session?.data?.user?.username,
			sessionUserId: session?.data?.user?.id,
			userFound: !!user,
			userId: user?.id,
			username: user?.username
		});

		// Now handle the OAuth state validation
		const expectedState = cookies.get('twitter_oauth_state');
		log.info('OAuth callback - State check', {
			hasExpectedState: !!expectedState,
			stateLength: expectedState?.length || 0,
			receivedState: state
		});

		if (!expectedState) {
			log.error('OAuth callback - Missing OAuth state cookie');
			throw redirect(303, '/accounts?error=oauth_state_missing');
		}

		// Clear the state cookie immediately to prevent replay attacks
		cookies.delete('twitter_oauth_state', { path: '/' });

		// Validate state with better error handling
		let validatedState: TwitterAuthState;
		try {
			validatedState = twitterAuth.validateState(state, expectedState);
			log.info('OAuth callback - State validation successful', {
				twitterAppId: validatedState.twitterAppId,
				hasCodeVerifier: !!validatedState.codeVerifier
			});
		} catch (error) {
			log.error('OAuth callback - State validation failed', {
				error: error instanceof Error ? error.message : String(error),
				receivedState: state,
				expectedState: expectedState.substring(0, 50) + '...'
			});
			throw redirect(303, '/accounts?error=invalid_oauth_state');
		}

		// Get Twitter app
		const app = await db.getTwitterApp(validatedState.twitterAppId);
		log.info('OAuth callback - App retrieval', {
			appFound: !!app,
			appId: app?.id,
			appName: app?.name
		});

		if (!app) {
			log.error('OAuth callback - Twitter app not found', {
				twitterAppId: validatedState.twitterAppId
			});
			throw redirect(303, '/accounts?error=twitter_app_not_found');
		}

		// Exchange code for tokens
		log.info('OAuth callback - Starting token exchange', {
			appId: app.id,
			codeLength: code.length,
			hasCodeVerifier: !!validatedState.codeVerifier
		});

		const tokens = await twitterAuth.exchangeCodeForToken(app, code, validatedState.codeVerifier);

		log.info('OAuth callback - Token exchange successful', {
			hasAccessToken: !!tokens.accessToken,
			hasRefreshToken: !!tokens.refreshToken,
			expiresIn: tokens.expiresIn
		});

		// Fetch user information
		log.info('OAuth callback - Fetching user info', {
			hasAccessToken: !!tokens.accessToken
		});

		// Add a small delay to prevent rate limiting
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const userInfo = await twitterAuth.fetchUserInfo(tokens.accessToken);
		log.info('OAuth callback - User info fetched', {
			userId: userInfo.id,
			username: userInfo.username,
			displayName: userInfo.name
		});

		// Check if account already exists
		const existingAccount = await twitterAuth.checkExistingAccount(userInfo.id);
		if (existingAccount) {
			log.info('OAuth callback - Twitter account already connected', {
				username: userInfo.username,
				accountId: existingAccount.id
			});
			throw redirect(303, '/accounts?error=account_already_connected');
		}

		// Save user account
		const accountId = await twitterAuth.saveUserAccount(
			userInfo,
			tokens,
			validatedState.twitterAppId,
			user.id
		);
		log.info('OAuth callback - Account saved successfully', {
			accountId,
			username: userInfo.username,
			twitterAppId: validatedState.twitterAppId
		});

		// Add a longer delay to ensure database consistency and write propagation
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Verify the account was actually saved by checking the database
		const savedAccount = await twitterAuth.checkExistingAccount(userInfo.id);
		if (!savedAccount) {
			log.error('OAuth callback - Account not found after save, retrying...', {
				username: userInfo.username,
				providerAccountId: userInfo.id
			});
			// Wait a bit more and try again
			await new Promise((resolve) => setTimeout(resolve, 1000));
			const retryAccount = await twitterAuth.checkExistingAccount(userInfo.id);
			if (!retryAccount) {
				log.error('OAuth callback - Account still not found after retry', {
					username: userInfo.username,
					providerAccountId: userInfo.id
				});
				throw redirect(303, '/accounts?error=account_save_failed');
			}
		}

		log.info('Twitter account connected successfully', {
			username: userInfo.username,
			accountId,
			twitterAppId: validatedState.twitterAppId,
			accountVerified: !!savedAccount
		});

		log.info('Redirecting to accounts page with success parameter', {
			redirectUrl: '/accounts?success=twitter_connected'
		});

		throw redirect(303, '/accounts?success=twitter_connected');
	} catch (error) {
		// If it's already a redirect, re-throw it
		if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
			throw error;
		}

		log.error('OAuth callback error:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined
		});

		// Redirect to accounts page with a generic error
		throw redirect(303, '/accounts?error=oauth_callback_failed');
	}
}

/**
 * Handle OAuth errors from Twitter
 */
function handleOAuthError(error: string, error_description?: string, state?: string) {
	const errorInfo: TwitterAuthError = {
		error,
		error_description,
		state
	};

	log.error('Twitter OAuth error:', errorInfo);

	let errorMessage = 'Twitter authentication failed';

	switch (error) {
		case 'access_denied':
			errorMessage = 'Access was denied by the user';
			break;
		case 'invalid_request':
			errorMessage = 'Invalid request to Twitter';
			break;
		case 'server_error':
			errorMessage = 'Twitter server error';
			break;
		case 'temporarily_unavailable':
			errorMessage = 'Twitter service temporarily unavailable';
			break;
		default:
			errorMessage = error_description || `Twitter error: ${error}`;
	}

	throw redirect(303, `/accounts?error=${encodeURIComponent(errorMessage)}`);
}
