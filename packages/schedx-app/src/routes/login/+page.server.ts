import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/validation/schemas';
import { signIn } from '$lib/server/auth';
import logger from '$lib/logger';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Redirect if already authenticated
	if (locals.isAuthenticated) {
		throw redirect(302, '/');
	}

	// Initialize form with empty values
	const form = await superValidate(zod(loginSchema));
	
	return { form };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await superValidate(request, zod(loginSchema));

		// Validate form data
		if (!form.valid) {
			return fail(400, { form });
		}

		const { username, password } = form.data;

		try {
			const result = await signIn({ username, password });

			if (result.error) {
				logger.warn('Login failed', { username, error: result.error });
				return message(form, 'Invalid username or password', { status: 401 });
			}

			if (!result.sessionId) {
				logger.error('Login succeeded but no session ID returned', { username });
				return message(form, 'An error occurred during login', { status: 500 });
			}

			// Set session cookie (30 days to match auth.ts)
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
			cookies.set('admin_session', result.sessionId, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				expires: expiresAt
			});

			logger.info('User logged in successfully', { username });

		} catch (error) {
			logger.error('Login error', { error, username });
			return message(form, 'An error occurred during login', { status: 500 });
		}

		// Redirect to dashboard on success
		throw redirect(302, '/');
	}
};
