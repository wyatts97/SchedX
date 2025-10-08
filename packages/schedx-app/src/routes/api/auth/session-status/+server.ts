import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import { log } from '$lib/server/logger';

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		const sessionId = cookies.get('admin_session');

		if (!sessionId) {
			return json({
				hasSession: false,
				message: 'No session cookie found',
				debug: {
					cookiePresent: false,
					sessionId: null
				}
			});
		}

		const db = getDbInstance();
		const session = await db.getSession(sessionId);

		if (!session) {
			return json({
				hasSession: false,
				message: 'Session not found or expired',
				sessionId: sessionId.substring(0, 8) + '...',
				debug: {
					cookiePresent: true,
					sessionId: sessionId.substring(0, 8) + '...',
					sessionFound: false,
					sessionExpired: true
				}
			});
		}

		// Also check if admin user exists
		const adminUser = await (db as any).getAdminUserByUsername('admin');

		return json({
			hasSession: true,
			session: {
				sessionId: session.sessionId.substring(0, 8) + '...',
				expiresAt: session.expiresAt,
				user: session.data.user,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt
			},
			debug: {
				cookiePresent: true,
				sessionId: sessionId.substring(0, 8) + '...',
				sessionFound: true,
				sessionExpired: false,
				adminUserExists: !!adminUser,
				sessionUsername: session.data.user.username,
				adminUsername: adminUser?.username,
				sessionBelongsToAdmin: session.data.user.username === 'admin'
			}
		});
	} catch (error) {
		log.error('Session status check error:', { error });
		const errorMessage = error instanceof Error ? error.message : String(error);
		return json(
			{
				hasSession: false,
				error: 'Failed to check session status',
				debug: {
					error: errorMessage
				}
			},
			{ status: 500 }
		);
	}
};
