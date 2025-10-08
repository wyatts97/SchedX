import { json } from '@sveltejs/kit';
import { getDbInstance, ensureDefaultAdminUser } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';
import logger from '$lib/server/logger';

export async function GET({ url }: RequestEvent) {
	try {
		const action = url.searchParams.get('action');
		const db = getDbInstance();

		if (action === 'check') {
			// Check if admin user exists
			const adminUser = await db.getAdminUserByUsername('admin');
			return json({
				exists: !!adminUser,
				user: adminUser
					? {
							id: adminUser.id,
							username: adminUser.username,
							displayName: adminUser.displayName,
							createdAt: adminUser.createdAt
						}
					: null
			});
		}

		if (action === 'create') {
			// Force create the default admin user
			await ensureDefaultAdminUser();
			const adminUser = await db.getAdminUserByUsername('admin');
			return json({
				created: true,
				user: adminUser
					? {
							id: adminUser.id,
							username: adminUser.username,
							displayName: adminUser.displayName,
							createdAt: adminUser.createdAt
						}
					: null
			});
		}

		return json({ error: 'Invalid action. Use ?action=check or ?action=create' }, { status: 400 });
	} catch (error) {
		logger.error('Debug admin error');
		return json(
			{
				error: 'Database error',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
}
