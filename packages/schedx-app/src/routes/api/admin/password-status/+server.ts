import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		
		// Get the session to find the user ID
		const session = await db.getSession(adminSession);
		if (!session || !session.data?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		
		// Get admin user by ID
		const user = await (db as any).getAdminUserById(session.data.user.id);
		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Check if user is still using default password
		// We'll check if username is 'admin' and password was never changed
		const requiresChange = user.username === 'admin' && !user.passwordChangedAt;

		return json({ 
			requiresChange,
			username: user.username
		});
	} catch (error) {
		logger.error('Error checking password status', { error });
		return json({ error: 'Failed to check password status' }, { status: 500 });
	}
};
