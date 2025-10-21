import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/logger';

const MAX_SAVED_PROMPTS = 50;

// GET - Fetch all saved prompts for user
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

		// Fetch saved prompts ordered by most recently created
		const prompts = db['db'].query(`
			SELECT id, prompt, tone, length, usageCount, createdAt, updatedAt
			FROM saved_prompts
			WHERE userId = ?
			ORDER BY createdAt DESC
		`).all(userId);

		return json({ prompts });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`Error fetching saved prompts: ${errorMsg}`);
		return json({ error: 'Failed to fetch saved prompts' }, { status: 500 });
	}
};

// POST - Save a new prompt
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

		// Check if user has reached the limit
		const count = db['db'].query(`
			SELECT COUNT(*) as count FROM saved_prompts WHERE userId = ?
		`).get(userId) as { count: number };

		if (count.count >= MAX_SAVED_PROMPTS) {
			return json({ 
				error: `Maximum of ${MAX_SAVED_PROMPTS} saved prompts reached. Please delete some to save new ones.` 
			}, { status: 400 });
		}

		// Check for duplicates
		const existing = db['db'].query(`
			SELECT id FROM saved_prompts 
			WHERE userId = ? AND prompt = ? AND tone = ? AND length = ?
		`).get(userId, prompt.trim(), tone || null, length || null);

		if (existing) {
			return json({ error: 'This prompt is already saved' }, { status: 400 });
		}

		// Save the prompt
		const id = crypto.randomUUID();
		const now = Date.now();

		db['db'].query(`
			INSERT INTO saved_prompts (id, userId, prompt, tone, length, usageCount, createdAt, updatedAt)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?)
		`).run(id, userId, prompt.trim(), tone || null, length || null, now, now);

		logger.info(`Saved prompt for user ${userId}`);

		return json({ 
			success: true,
			prompt: { id, prompt: prompt.trim(), tone, length, usageCount: 0, createdAt: now, updatedAt: now }
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`Error saving prompt: ${errorMsg}`);
		return json({ error: 'Failed to save prompt' }, { status: 500 });
	}
};

// DELETE - Delete a saved prompt
export const DELETE: RequestHandler = async ({ request, cookies }) => {
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
		const { id } = await request.json();

		if (!id) {
			return json({ error: 'Prompt ID is required' }, { status: 400 });
		}

		// Delete the prompt (only if it belongs to the user)
		db['db'].query(`
			DELETE FROM saved_prompts WHERE id = ? AND userId = ?
		`).run(id, userId);

		logger.info(`Deleted saved prompt ${id} for user ${userId}`);

		return json({ success: true });
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`Error deleting prompt: ${errorMsg}`);
		return json({ error: 'Failed to delete prompt' }, { status: 500 });
	}
};
