import { json } from '@sveltejs/kit';
import { getDbInstance } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies }) => {
	// Check if user is authenticated (admin)
	const adminSession = cookies.get('admin_session');
	if (!adminSession || adminSession.trim() === '') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { templateId } = await request.json();
	try {
		await getDbInstance().deleteDraft(templateId, 'admin');
		return json({ success: true });
	} catch (error) {
		return json({ error: 'Failed to delete template.' }, { status: 500 });
	}
};
