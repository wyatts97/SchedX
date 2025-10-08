import { getDbInstance } from './db';
import bcrypt from 'bcrypt';
import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import logger from '$lib/logger';

// Track last cleanup time to avoid running it on every request
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

async function cleanupExpiredSessionsIfNeeded() {
	const now = Date.now();
	if (now - lastCleanupTime > CLEANUP_INTERVAL) {
		try {
			const db = getDbInstance();
			await db.cleanupExpiredSessions();
			lastCleanupTime = now;
		} catch (error) {
			logger.error('Session cleanup error', { error });
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
					displayName: session.data.user.displayName,
					avatar: session.data.user.avatar,
					email: session.data.user.email
				};
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

		const sessionId = crypto.randomUUID();
		const sessionData = {
			user: {
				id: user.id || user.username,
				username: user.username,
				displayName: (user as any).displayName || user.username,
				avatar: (user as any).avatar || '/avatar.png',
				email: (user as any).email || `${user.username}@admin.local`
			}
		};

		// Set session to expire in 30 days
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		await db.saveSession(sessionId, sessionData, expiresAt);

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
