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
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			return json(
				{
					profile: { username: '', displayName: '', email: '', avatar: '' },
					error: 'Unauthorized'
				},
				{ status: 401 }
			);
		}

		return json({
			profile: {
				username: user.username ?? '',
				displayName: user.displayName ?? '',
				email: user.email ?? '',
				avatar: user.avatar ?? ''
			}
		});
	} catch (error) {
		logger.error('Error fetching profile');
		return json(
			{
				profile: { username: '', displayName: '', email: '', avatar: '' },
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
		const user = await (db as any).getAdminUserByUsername('admin');
		if (!user) {
			logger.debug('Profile update: Admin user not found');
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		logger.debug('Profile update: Processing request for user:', user.username);

		const formData = await request.formData();
		const username = formData.get('username')?.toString() || '';
		const displayName = formData.get('displayName')?.toString() || '';
		const email = formData.get('email')?.toString() || '';

		logger.debug('Profile update: Form data received');

		// Prevent username changes since authentication is hardcoded to 'admin'
		if (username !== 'admin') {
			return json({ error: 'Username cannot be changed from "admin"' }, { status: 400 });
		}

		// Update admin user profile (no avatar logic)
		await (db as any).updateAdminUserProfile(user.id, {
			displayName,
			email,
			updatedAt: new Date()
		});

		logger.debug('Profile update: Successfully updated profile');
		return json({ success: true });
	} catch (error) {
		logger.error('Error updating profile');
		return json({ error: 'Failed to update profile' }, { status: 500 });
	}
};
