import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { verifyPassword, hashPassword } from '$lib/server/auth';
import logger from '$lib/server/logger';
import { changePasswordSchema } from '$lib/validation/schemas';

// Common weak passwords to reject
const COMMON_PASSWORDS = [
	'password', 'password1', 'password123', '12345678', '123456789',
	'qwerty123', 'admin123', 'letmein', 'welcome1', 'changeme'
];

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

		const body = await request.json();
		
		// SECURITY: Validate password complexity using Zod schema
		const validation = changePasswordSchema.safeParse(body);
		if (!validation.success) {
			const errors = validation.error.errors.map(e => e.message);
			return json({ error: errors[0] || 'Invalid input' }, { status: 400 });
		}
		
		const { currentPassword, newPassword } = validation.data;

		// Validate current password
		const validCurrentPassword = await verifyPassword(currentPassword, user.passwordHash);
		if (!validCurrentPassword) {
			logger.warn({ userId: user.id }, 'Failed password change attempt - wrong current password');
			return json({ error: 'Current password is incorrect' }, { status: 400 });
		}

		// SECURITY: Check against common passwords
		if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
			return json({ error: 'Password is too common. Please choose a stronger password.' }, { status: 400 });
		}
		
		// SECURITY: Prevent password reuse
		const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
		if (isSamePassword) {
			return json({ error: 'New password must be different from current password' }, { status: 400 });
		}

		// Hash new password and update
		const newPasswordHash = await hashPassword(newPassword);
		await (db as any).updateAdminUserPassword(user.id, newPasswordHash);
		
		logger.info({ userId: user.id }, 'Password changed successfully');

		return json({ success: true, message: 'Password changed successfully' });
	} catch (error) {
		logger.error('Error changing password');
		return json({ error: 'Failed to change password. Please try again.' }, { status: 500 });
	}
};
