import { redirect } from '@sveltejs/kit';
import { beginConnect, connectMockAccount, xConfigured } from '#lib/server/x/oauth.js';
import { rt } from '#lib/server/runtime.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	if (rt().xMode === 'mock') {
		const account = await connectMockAccount();
		redirect(303, `/accounts?connected=${encodeURIComponent(account.username)}`);
	}
	if (!xConfigured()) redirect(303, '/accounts?error=not_configured');
	redirect(303, beginConnect(url.origin));
};
