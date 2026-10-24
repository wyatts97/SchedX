import { fail } from '@sveltejs/kit';
import {
	disconnectAccount,
	getAccount,
	pendingPostCount,
	setDefaultAccount,
	setPremium
} from '#lib/server/x/accounts.js';
import { callbackUrl, xConfigured } from '#lib/server/x/oauth.js';
import { rt } from '#lib/server/runtime.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { accounts } = await parent();
	return {
		configured: xConfigured(),
		callback: callbackUrl(url.origin),
		pending: Object.fromEntries(accounts.map((a) => [a.id, pendingPostCount(a.id)])),
		mock: rt().xMode === 'mock'
	};
};

function accountId(form: FormData) {
	const id = String(form.get('id') ?? '');
	return getAccount(id) ? id : null;
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const id = accountId(form);
		if (!id) return fail(404, { error: 'Account not found' });
		setDefaultAccount(id);
		return { ok: true };
	},
	premium: async ({ request }) => {
		const form = await request.formData();
		const id = accountId(form);
		if (!id) return fail(404, { error: 'Account not found' });
		setPremium(id, form.get('premium') === 'on');
		return { ok: true };
	},
	disconnect: async ({ request }) => {
		const form = await request.formData();
		const id = accountId(form);
		if (!id) return fail(404, { error: 'Account not found' });
		await disconnectAccount(id);
		return { ok: true };
	}
};
