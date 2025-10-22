import { json } from '@sveltejs/kit';
import { signIn } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import logger from '$lib/logger';
import { createValidationMiddleware } from '$lib/validation/middleware';
import { loginSchema, type LoginData } from '$lib/validation/schemas';
import crypto from 'crypto';

// Common headers for CORS
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '600'
} as const;

export const OPTIONS = () => {
    return new Response(null, { headers: corsHeaders });
};

// Generate a request ID if not provided
const generateRequestId = () => crypto.randomUUID();

type SignInResult = {
    error?: string;
    errorDetails?: string;
    sessionId?: string;
};

const loginHandler = async (data: LoginData, { cookies, request }: { cookies: any; request: Request }) => {
    // Generate or use provided request ID
    const requestId = data.requestId || generateRequestId();
    const requestInfo = {
        requestId,
        username: data.username,
        userAgent: request.headers.get('user-agent') || 'unknown',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    };

    try {
        logger.info('Login attempt', { ...requestInfo });
        
        // Log the validation result
        const validation = loginSchema.safeParse(data);
        if (!validation.success) {
            const validationErrors = validation.error.format();
            logger.warn('Login validation failed', { 
                ...requestInfo, 
                validationErrors
            });
            
            return json({ 
                error: 'Invalid input',
                requestId,
                validationErrors
            }, { 
                status: 400,
                headers: corsHeaders
            });
        }

        const result: SignInResult = await signIn(data);

        if (result.error) {
            logger.warn('Login failed', { 
                ...requestInfo, 
                error: result.error,
                errorDetails: result.errorDetails || 'No additional details'
            });
            
            return json({ 
                error: 'Invalid username or password', // Generic message for security
                requestId // Include request ID in response for support
            }, { 
                status: 401,
                headers: corsHeaders
            });
        }

        logger.info('Login successful', { 
            ...requestInfo,
            sessionId: result.sessionId ? '***' : 'none' // Don't log actual session ID
        });

        // Set session cookie
        // IMPORTANT: Must use 'lax' sameSite to support OAuth redirects from Twitter
        // 'strict' would prevent the cookie from being sent when Twitter redirects back
        const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
        
        if (!result.sessionId) {
            logger.error('Missing sessionId in successful login', { requestId });
            throw new Error('Session creation failed');
        }

        cookies.set('admin_session', result.sessionId, {
            path: '/',
            httpOnly: true,
            secure: !allowLocalNetwork && process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Must be 'lax' for OAuth to work
            maxAge: 8 * 60 * 60 // 8 hours
        });

        return json({ 
            success: true,
            requestId
        }, {
            headers: corsHeaders
        });
    } catch (error) {
        const errorId = crypto.randomUUID();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        logger.error('Login error', { 
            ...requestInfo,
            error: errorMessage,
            errorId,
            stack: error instanceof Error ? error.stack : undefined
        });
        
        return json({ 
            error: 'An unexpected error occurred',
            requestId,
            errorId
        }, { 
            status: 500,
            headers: corsHeaders
        });
    }
};

export const POST = createValidationMiddleware(loginSchema)(loginHandler);
