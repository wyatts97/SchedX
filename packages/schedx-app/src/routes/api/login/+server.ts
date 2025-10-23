import { json } from '@sveltejs/kit';
import { signIn } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import logger from '$lib/logger';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { loginSchema, type LoginData } from '$lib/validation/schemas';
import { ipRateLimit, RATE_LIMITS } from '$lib/rate-limiting';

export const POST = ipRateLimit(RATE_LIMITS.login)(
    createValidationMiddleware(loginSchema)(async (data: LoginData, { cookies }) => {
        try {
            logger.info('Login attempt', { username: data.username });
            const result = await signIn(data);

            if (result.error) {
                logger.warn('Login failed', { username: data.username, error: result.error });
                return json({ error: result.error }, { status: 401 });
            }

            logger.info('Login successful', { username: data.username });
            // Set session cookie (30 days to match session expiry)
            const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
            cookies.set('admin_session', result.sessionId!, {
                path: '/',
                httpOnly: true,
                secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 30 * 24 * 60 * 60
            });

            return json({ success: true });
        } catch (error) {
            logger.error('Login error', { error });
            return json({ error: 'Internal server error' }, { status: 500 });
        }
    }) // Added missing closing parenthesis for createValidationMiddleware
); // Added missing semicolon and parenthesis for ipRateLimit