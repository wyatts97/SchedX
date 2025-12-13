import { json } from '@sveltejs/kit';
import { signIn } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import logger from '$lib/logger';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { loginSchema, type LoginData } from '$lib/validation/schemas';
import { ipRateLimit, RATE_LIMITS } from '$lib/rate-limiting';

// SECURITY: Track failed login attempts for alerting
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const FAILED_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const ALERT_THRESHOLD = 3; // Alert after 3 failed attempts

function trackFailedAttempt(identifier: string, username: string): void {
    const now = Date.now();
    const attempts = failedAttempts.get(identifier);
    
    if (!attempts || now - attempts.lastAttempt > FAILED_ATTEMPT_WINDOW) {
        // Reset if window expired
        failedAttempts.set(identifier, { count: 1, lastAttempt: now });
    } else {
        attempts.count++;
        attempts.lastAttempt = now;
        
        // SECURITY: Log warning if threshold exceeded
        if (attempts.count >= ALERT_THRESHOLD) {
            logger.warn(`⚠️ SECURITY ALERT: Multiple failed login attempts (${attempts.count}) from ${identifier} for user "${username}"`);
        }
    }
}

function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfIp = request.headers.get('cf-connecting-ip');
    
    if (cfIp) return cfIp;
    if (realIp) return realIp;
    if (forwarded) return forwarded.split(',')[0].trim();
    return 'unknown';
}

export const POST = ipRateLimit(RATE_LIMITS.login)(
    createValidationMiddleware(loginSchema)(async (data: LoginData, { cookies, request }) => {
        const clientIP = getClientIP(request);
        
        try {
            logger.info(`Login attempt for user "${data.username}" from ${clientIP}`);
            const result = await signIn(data);

            if (result.error) {
                // SECURITY: Track failed attempts
                trackFailedAttempt(clientIP, data.username);
                logger.warn(`Login failed for user "${data.username}" from ${clientIP}: ${result.error}`);
                return json({ error: result.error }, { status: 401 });
            }

            // SECURITY: Clear failed attempts on successful login
            failedAttempts.delete(clientIP);
            
            logger.info(`Login successful for user "${data.username}" from ${clientIP}`);
            
            // Set session cookie (7 days sliding window, 30 days max)
            const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
            cookies.set('admin_session', result.sessionId!, {
                path: '/',
                httpOnly: true,
                secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 // 7 days (sliding window)
            });

            return json({ success: true });
        } catch (error) {
            logger.error(`Login error for user "${data.username}" from ${clientIP}`);
            return json({ error: 'Internal server error' }, { status: 500 });
        }
    })
);