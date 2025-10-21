import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { mkdirSync, existsSync, createWriteStream } from 'fs';
import path from 'path';
import logger from '$lib/server/logger';

// Save avatars to uploads/avatars so they are publicly accessible and separate from tweet media
// In Docker, uploads are at /app/packages/schedx-app/uploads
// In dev, they're at process.cwd()/uploads
const AVATAR_UPLOADS_DIR = process.env.DOCKER === 'true'
	? '/app/packages/schedx-app/uploads/avatars'
	: path.join(process.cwd(), 'uploads/avatars');

if (!existsSync(AVATAR_UPLOADS_DIR)) {
	mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
}

export const GET: RequestHandler = async ({ cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			return json(
				{
					profile: { username: '', email: '', avatar: '' },
					error: 'Invalid session'
				},
				{ status: 401 }
			);
		}

		return json({
			profile: {
				username: session.data.user.username ?? '',
				email: session.data.user.email ?? '',
				avatar: session.data.user.avatar ?? ''
			}
		});
	} catch (error) {
		logger.error('Error fetching profile', { error: error instanceof Error ? error.message : String(error) });
		return json(
			{
				profile: { username: '', email: '', avatar: '' },
				error: 'Failed to fetch profile'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		logger.debug('Profile update: No admin session found');
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		
		// Get user from session
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			logger.debug('Profile update: Invalid session');
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		logger.debug('Profile update: Processing request for user:', session.data.user.username);

		const formData = await request.formData();
		const username = formData.get('username')?.toString() || '';
		const email = formData.get('email')?.toString() || '';

		logger.debug('Profile update: Form data received');

		// Validate username format
		if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
			return json({ error: 'Username must be 3-20 characters (letters, numbers, underscores only)' }, { status: 400 });
		}

		// Validate email format
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		// Update user profile
		try {
			await (db as any).updateAdminUserProfile(session.data.user.id, {
				username: username || undefined,
				email: email || undefined
			});
		} catch (error: any) {
			if (error.message === 'Username already taken') {
				return json({ error: 'Username already taken' }, { status: 400 });
			}
			throw error;
		}

		logger.debug('Profile update: Successfully updated profile');
		return json({ success: true });
	} catch (error) {
		logger.error('Error updating profile', { error: error instanceof Error ? error.message : String(error) });
		return json({ error: 'Failed to update profile' }, { status: 500 });
	}
};
