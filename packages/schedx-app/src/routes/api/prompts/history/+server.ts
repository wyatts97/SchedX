import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/logger';

const MAX_HISTORY = 10;

// GET - Fetch prompt history for user
export const GET: RequestHandler = async ({ cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		
		if (!session || !session.data?.user?.id) {
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		const userId = session.data.user.id;

		// Fetch history ordered by most recent
		const history = db['db'].prepare(`
			SELECT id, prompt, tone, length, createdAt
			FROM prompt_history
			WHERE userId = ?
			ORDER BY createdAt DESC
			LIMIT ${MAX_HISTORY}
		`).all(userId);

		return json({ history });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`Error fetching prompt history: ${errorMsg}`);
		return json({ error: 'Failed to fetch prompt history' }, { status: 500 });
	}
};

// POST - Add to prompt history (auto-saved when user generates)
export const POST: RequestHandler = async ({ request, cookies }) => {
	const adminSession = cookies.get('admin_session');

	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const db = getDbInstance();
		const session = await db.getSession(adminSession);
		
		if (!session || !session.data?.user?.id) {
			return json({ error: 'Invalid session' }, { status: 401 });
		}

		const userId = session.data.user.id;
		const { prompt, tone, length } = await request.json();

		if (!prompt || prompt.trim() === '') {
			return json({ error: 'Prompt is required' }, { status: 400 });
		}

		// Check if this exact prompt already exists in history
		const existing = db['db'].prepare(`
			SELECT id FROM prompt_history 
			WHERE userId = ? AND prompt = ? AND tone = ? AND length = ?
		`).get(userId, prompt.trim(), tone || null, length || null);

		if (existing) {
			// Update the timestamp to move it to the top
			db['db'].prepare(`
				UPDATE prompt_history SET createdAt = ? WHERE id = ?
			`).run(Date.now(), (existing as any).id);
		} else {
			// Add new history entry
			const id = crypto.randomUUID();
			const now = Date.now();

			db['db'].prepare(`
				INSERT INTO prompt_history (id, userId, prompt, tone, length, createdAt)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run(id, userId, prompt.trim(), tone || null, length || null, now);

			// Keep only the last 10 entries
			const allHistory = db['db'].prepare(`
				SELECT id FROM prompt_history
				WHERE userId = ?
				ORDER BY createdAt DESC
			`).all(userId) as Array<{ id: string }>;

			if (allHistory.length > MAX_HISTORY) {
				const toDelete = allHistory.slice(MAX_HISTORY).map(h => h.id);
				const placeholders = toDelete.map(() => '?').join(',');
				db['db'].prepare(`
					DELETE FROM prompt_history WHERE id IN (${placeholders})
				`).run(...toDelete);
			}
		}

		return json({ success: true });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`Error adding to prompt history: ${errorMsg}`);
		return json({ error: 'Failed to add to history' }, { status: 500 });
	}
};
