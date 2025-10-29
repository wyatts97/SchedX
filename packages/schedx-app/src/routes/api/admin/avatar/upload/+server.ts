import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/logger';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function getAvatarUploadDir(): string {
	return process.env.DOCKER === 'true'
		? '/app/packages/schedx-app/uploads/avatars'
		: path.join(process.cwd(), 'uploads/avatars');
}

async function ensureUploadDir(dir: string): Promise<void> {
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return new Response(
			JSON.stringify({ error: 'Unauthorized' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	try {
		// Ensure upload directory exists
		const AVATAR_UPLOADS_DIR = getAvatarUploadDir();
		await ensureUploadDir(AVATAR_UPLOADS_DIR);
		
		const formData = await request.formData();
		const file = formData.get('avatar') as File;

		if (!file) {
			return new Response(
				JSON.stringify({ error: 'No file provided' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Validate file type
		if (!ALLOWED_TYPES.includes(file.type)) {
			return new Response(
				JSON.stringify({ error: 'Invalid file type. Only JPG, PNG, GIF, and WebP are allowed.' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Validate file size
		if (file.size > MAX_SIZE) {
			return new Response(
				JSON.stringify({ error: 'File too large. Maximum size is 2MB.' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Get user from session
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user) {
			return new Response(
				JSON.stringify({ error: 'Invalid session' }),
				{ status: 401, headers: { 'Content-Type': 'application/json' } }
			);
		}
		
		const userId = session.data.user.id;

		// Generate unique filename
		const ext = path.extname(file.name);
		const filename = `avatar-${userId}-${Date.now()}${ext}`;
		const filepath = path.join(AVATAR_UPLOADS_DIR, filename);

		// Save file
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filepath, buffer);

		// Avatar URL (relative to static folder)
		const avatarUrl = `/uploads/avatars/${filename}`;

		// Update user profile with new avatar
		await (db as any).updateAdminUserProfile(userId, {
			avatar: avatarUrl
		});

		// Update session data to reflect avatar change immediately
		const updatedSessionData = {
			...session.data,
			user: {
				...session.data.user,
				avatar: avatarUrl
			}
		};
		
		// Save updated session
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		await db.saveSession(adminSession, updatedSessionData, expiresAt);

		logger.info('Avatar uploaded successfully', { userId, filename });

		return new Response(
			JSON.stringify({ 
				success: true, 
				avatarUrl 
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		logger.error('Avatar upload failed', { error });
		return new Response(
			JSON.stringify({ error: 'Failed to upload avatar' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
