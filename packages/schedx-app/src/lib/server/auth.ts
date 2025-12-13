import { getDbInstance } from './db';
import bcrypt from 'bcrypt';
import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import logger from '$lib/logger';

// Track last cleanup time and lock to avoid race conditions
let lastCleanupTime = 0;
let cleanupInProgress = false;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

// SECURITY: Session configuration
const SESSION_CONFIG = {
	// Sliding window: extend session on activity
	slidingWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days of inactivity before expiry
	// Maximum absolute lifetime (even with activity)
	maxLifetimeMs: 30 * 24 * 60 * 60 * 1000, // 30 days max
	// Minimum time between session extension updates (to avoid DB thrashing)
	extensionThrottleMs: 60 * 60 * 1000, // 1 hour
};

async function cleanupExpiredSessionsIfNeeded() {
	const now = Date.now();
	
	// Check if cleanup is needed and not already in progress
	if (now - lastCleanupTime > CLEANUP_INTERVAL && !cleanupInProgress) {
		// Set lock immediately to prevent concurrent cleanups
		cleanupInProgress = true;
		
		try {
			const db = getDbInstance();
			await db.cleanupExpiredSessions();
			lastCleanupTime = now;
			logger.debug('Session cleanup completed successfully');
		} catch (error) {
			logger.error('Session cleanup error', { error });
		} finally {
			// Always release the lock
			cleanupInProgress = false;
		}
	}
}

export const handle = async ({ event, resolve }: any) => {
	try {
		// Cleanup expired sessions periodically
		await cleanupExpiredSessionsIfNeeded();

		// Get session from cookie
		const sessionId = event.cookies.get('admin_session');

		if (sessionId) {
			const db = getDbInstance();
			const session = await db.getSession(sessionId);

			if (session) {
				event.locals.session = session.data;
				event.locals.isAuthenticated = true;
				event.locals.isAdmin = true;
				event.locals.user = {
					id: session.data.user.id,
					username: session.data.user.username,
					avatar: session.data.user.avatar,
					email: session.data.user.email
				};
				
				// SECURITY: Sliding session expiration
				// Extend session if user is active (but throttle updates)
				const now = Date.now();
				const sessionCreatedAt = session.data.createdAt || now;
				const lastExtended = session.data.lastExtended || sessionCreatedAt;
				const sessionAge = now - sessionCreatedAt;
				const timeSinceExtension = now - lastExtended;
				
				// Only extend if:
				// 1. Session hasn't exceeded max lifetime
				// 2. Enough time has passed since last extension (throttle)
				if (
					sessionAge < SESSION_CONFIG.maxLifetimeMs &&
					timeSinceExtension > SESSION_CONFIG.extensionThrottleMs
				) {
					const newExpiry = new Date(now + SESSION_CONFIG.slidingWindowMs);
					const updatedData = {
						...session.data,
						lastExtended: now
					};
					
					// Update session in background (don't await to avoid blocking request)
					db.saveSession(sessionId, updatedData, newExpiry).catch(err => {
						logger.error('Failed to extend session', { error: err });
					});
				}
			} else {
				// Session not found or expired, clear cookie
				event.cookies.delete('admin_session', { path: '/' });
				event.locals.session = null;
				event.locals.isAuthenticated = false;
				event.locals.isAdmin = false;
				event.locals.user = null;
			}
		} else {
			event.locals.session = null;
			event.locals.isAuthenticated = false;
			event.locals.isAdmin = false;
			event.locals.user = null;
		}

		// Add auth function to locals
		event.locals.auth = async () => {
			return event.locals.session;
		};

		return resolve(event);
	} catch (error) {
		logger.error('Auth handler error', { error });
		// Set default values on error
		event.locals.session = null;
		event.locals.isAuthenticated = false;
		event.locals.isAdmin = false;
		event.locals.user = null;
		event.locals.auth = async () => null;
		return resolve(event);
	}
};

export async function signIn(credentials: { username: string; password: string }) {
	try {
		const db = getDbInstance();
		const user = await db.getAdminUserByUsername(credentials.username);

		if (!user) {
			return { error: 'Invalid credentials' };
		}

		const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

		if (!isPasswordValid) {
			return { error: 'Invalid credentials' };
		}

		// Ensure user has a valid ID
		if (!user.id) {
			logger.error('User missing ID', { username: user.username });
			return { error: 'Invalid user data' };
		}

		const sessionId = crypto.randomUUID();
		const now = Date.now();
		const sessionData = {
			user: {
				id: user.id,
				username: user.username,
				avatar: (user as any).avatar || '/avatar.png',
				email: (user as any).email || `${user.username}@admin.local`
			},
			// SECURITY: Track session creation and extension times for sliding expiration
			createdAt: now,
			lastExtended: now
		};

		// SECURITY: Session expires after sliding window of inactivity
		const expiresAt = new Date(now + SESSION_CONFIG.slidingWindowMs);
		await db.saveSession(sessionId, sessionData, expiresAt);
		
		logger.info(`User logged in successfully: ${user.username}`);

		return { sessionId };
	} catch (error) {
		logger.error('Auth error', { error });
		return { error: 'Authentication failed' };
	}
}

export async function signOut(sessionId: string) {
	try {
		const db = getDbInstance();
		await db.deleteSession(sessionId);
	} catch (error) {
		logger.error('Sign out error', { error });
	}
}

// Helper functions for password hashing
export async function hashPassword(password: string): Promise<string> {
	return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
	return await bcrypt.compare(password, hashedPassword);
}
