import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
	createSession,
	createUser,
	hasUser,
	MIN_PASSWORD_LENGTH,
	SESSION_COOKIE
} from '#lib/server/auth/index.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (hasUser()) redirect(303, '/login');
};

const schema = z
	.object({
		username: z
			.string()
			.trim()
			.min(2, 'Use at least 2 characters')
			.max(40)
			.regex(/^[\w.-]+$/, 'Letters, numbers, . _ - only'),
		password: z
			.string()
			.min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
			.max(200),
		confirm: z.string(),
		timezone: z.string().default('UTC')
	})
	.refine((d) => d.password === d.confirm, {
		message: 'Passwords do not match',
		path: ['confirm']
	});

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (hasUser()) redirect(303, '/login');
		const form = Object.fromEntries(await request.formData());
		const parsed = schema.safeParse(form);
		if (!parsed.success) {
			return fail(400, {
				username: String(form.username ?? ''),
				errors: Object.fromEntries(
					parsed.error.issues.map((i) => [i.path[0], i.message])
				) as Record<string, string>
			});
		}
		let tz = parsed.data.timezone;
		try {
			new Intl.DateTimeFormat(undefined, { timeZone: tz });
		} catch {
			tz = 'UTC';
		}
		const user = await createUser(parsed.data.username, parsed.data.password, tz);
		const session = createSession(user.id, request.headers.get('user-agent'));
		cookies.set(SESSION_COOKIE, session.token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			expires: new Date(session.expiresAt)
		});
		redirect(303, '/accounts?welcome=1');
	}
};
