import { fail } from '@sveltejs/kit';
import {
	changePassword,
	listSessions,
	MIN_PASSWORD_LENGTH,
	revokeOtherSessions
} from '#lib/server/auth/index.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	sessions: listSessions(locals.user!.id).map((s) => ({
		current: s.id === locals.sessionId,
		createdAt: s.createdAt,
		userAgent: s.userAgent
	}))
});

export const actions: Actions = {
	password: async ({ request, locals }) => {
		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		if (next.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { passwordError: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
		}
		if (next !== form.get('confirm'))
			return fail(400, { passwordError: 'New passwords do not match.' });
		const res = await changePassword(locals.user!.id, current, next, locals.sessionId!);
		if (!res.ok) return fail(400, { passwordError: res.error });
		return { passwordChanged: true };
	},
	signOutOthers: ({ locals }) => {
		revokeOtherSessions(locals.user!.id, locals.sessionId!);
		return { signedOut: true };
	}
};
