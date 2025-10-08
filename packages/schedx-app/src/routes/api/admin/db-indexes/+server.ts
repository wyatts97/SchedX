import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createDatabaseIndexes, dropAllIndexes, getIndexStats } from '$lib/server/db-indexes';
import logger from '$lib/logger';

// GET - Get index statistics
export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const stats = await getIndexStats();
		return json({ stats });
	} catch (error) {
		logger.error('Failed to get index stats', { error });
		return json({ error: 'Failed to get index statistics' }, { status: 500 });
	}
};

// POST - Create indexes
export const POST: RequestHandler = async ({ cookies, request }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { action } = await request.json();

		if (action === 'create') {
			await createDatabaseIndexes();
			logger.info('Database indexes created via admin API');
			return json({ message: 'Database indexes created successfully' });
		} else if (action === 'drop') {
			await dropAllIndexes();
			logger.warn('Database indexes dropped via admin API');
			return json({ message: 'Database indexes dropped successfully' });
		} else {
			return json({ error: 'Invalid action. Use "create" or "drop"' }, { status: 400 });
		}
	} catch (error) {
		logger.error('Failed to manage database indexes', { error });
		return json({ error: 'Failed to manage database indexes' }, { status: 500 });
	}
};
