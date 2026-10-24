import { fail, redirect } from '@sveltejs/kit';
import { createSession, SESSION_COOKIE, verifyLogin } from '#lib/server/auth/index.js';
import { loginLimiter } from '#lib/server/auth/rate-limit.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

function safeNext(value: string | null): string {
	return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress();
		const wait = loginLimiter.hit(ip);
		if (wait)
			return fail(429, {
				username: '',
				error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`
			});

		const form = await request.formData();
		const username = String(form.get('username') ?? '');
		const user = await verifyLogin(username, String(form.get('password') ?? ''));
		if (!user) return fail(400, { username, error: 'Wrong username or password.' });

		loginLimiter.reset(ip);
		const session = createSession(user.id, request.headers.get('user-agent'));
		cookies.set(SESSION_COOKIE, session.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: new Date(session.expiresAt)
		});
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
