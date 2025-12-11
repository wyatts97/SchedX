import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { verifyPassword, hashPassword } from '$lib/server/auth';
import logger from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, cookies }: any) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized - No session found' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		
		// Get the session to find the user ID
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return json({ error: 'Unauthorized - Invalid session' }, { status: 401 });
		}
		
		// Get admin user by ID from session (works regardless of username)
		const user = await (db as any).getAdminUserById(session.data.user.id);
		if (!user) {
			return json({ error: 'Unauthorized - Admin user not found' }, { status: 401 });
		}

		const { currentPassword, newPassword } = await request.json();

		// Validate current password
		const validCurrentPassword = await verifyPassword(currentPassword, user.passwordHash);
		if (!validCurrentPassword) {
			return json({ error: 'Current password is incorrect' }, { status: 400 });
		}

		// Validate new password
		if (!newPassword || newPassword.length < 6) {
			return json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
		}

		// Hash new password and update
		const newPasswordHash = await hashPassword(newPassword);
		await (db as any).updateAdminUserPassword(user.id, newPasswordHash);

		return json({ success: true, message: 'Password changed successfully' });
	} catch (error) {
		logger.error('Error changing password');
		return json({ error: 'Failed to change password. Please try again.' }, { status: 500 });
	}
};
