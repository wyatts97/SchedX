import { json } from '@sveltejs/kit';
import { signOut } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import logger from '$lib/server/logger';

export async function POST({ cookies }: RequestEvent) {
	try {
		const sessionId = cookies.get('admin_session');

		if (sessionId) {
			await signOut(sessionId);
			cookies.delete('admin_session', { path: '/' });
		}

		return json({ success: true });
	} catch (error) {
		logger.error('Logout error');
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
