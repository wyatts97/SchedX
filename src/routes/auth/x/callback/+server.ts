import { redirect } from '@sveltejs/kit';
import { completeConnect } from '#lib/server/x/oauth.js';
import { XError } from '#lib/server/x/types.js';
import { logger } from '#lib/server/logger.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const fail = (message: string) => redirect(303, `/accounts?error=${encodeURIComponent(message)}`);

	const denied = url.searchParams.get('error');
	if (denied)
		fail(
			denied === 'access_denied' ? 'You cancelled the connection on X.' : `X returned: ${denied}`
		);

	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	if (!state || !code) fail('The response from X was incomplete. Try connecting again.');

	let username: string;
	try {
		username = (await completeConnect(state!, code!)).username;
	} catch (err) {
		logger.warn({ err: (err as Error).message }, 'X OAuth callback failed');
		fail(err instanceof XError ? err.message : 'Connecting to X failed. Try again.');
	}
	redirect(303, `/accounts?connected=${encodeURIComponent(username!)}`);
};
