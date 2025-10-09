import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handle as authHandle } from '$lib/server/auth';
import { initializeDatabase, ensureDefaultAdminUser } from '$lib/server/db';
import logger from '$lib/server/logger';
import { RequestContext, logApiRequest, logApiError } from '$lib/server/logging';
import { initSentry, captureException, setUser, addBreadcrumb } from '$lib/server/sentry';
import { apiRateLimiter, authRateLimiter, getRateLimitIdentifier, createRateLimitResponse } from '$lib/server/rate-limiter';

// Initialize Sentry
initSentry();

// Initialize database and ensure default admin user
let dbInitialized = false;

const initDb = async () => {
	if (!dbInitialized) {
		try {
			await initializeDatabase();
			await ensureDefaultAdminUser();
			dbInitialized = true;
			logger.debug('Database initialized successfully');
		} catch (error) {
			logger.error({ error }, 'Database initialization failed');
			captureException(error as Error, { context: 'database_initialization' });
		}
	}
};

/**
 * CORS and Origin handling middleware
 */
const corsHandle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin');
	const allowedOrigins = (process.env.ORIGIN || '').split(',').map(o => o.trim());
	
	// Check if origin is allowed
	let isAllowedOrigin = origin && allowedOrigins.includes(origin);
	
	// SECURITY: Allow local network IPs only if explicitly enabled
	// This is useful for self-hosted/home lab deployments but should be disabled for production
	const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
	
	if (!isAllowedOrigin && origin && allowLocalNetwork) {
		const localNetworkPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
		isAllowedOrigin = localNetworkPattern.test(origin);
		
		if (isAllowedOrigin) {
			logger.debug({ origin }, 'Allowing local network origin');
		}
	}
	
	const response = await resolve(event);
	
	// Add CORS headers if origin is allowed
	if (isAllowedOrigin && origin) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}
	
	return response;
};

/**
 * Rate limiting middleware
 */
const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	
	// Apply rate limiting to API routes
	if (path.startsWith('/api/')) {
		const identifier = getRateLimitIdentifier(event.request, event.locals.user?.id);
		
		// Use stricter rate limiting for auth endpoints
		const limiter = path.startsWith('/api/auth') || path.startsWith('/api/login')
			? authRateLimiter
			: apiRateLimiter;
		
		const result = limiter.check(identifier);
		
		if (!result.allowed) {
			logger.warn({
				type: 'rate_limit_exceeded',
				path,
				identifier,
				resetTime: result.resetTime
			}, 'Rate limit exceeded');
			
			return createRateLimitResponse(result.resetTime);
		}
		
		// Add rate limit headers
		const response = await resolve(event);
		response.headers.set('X-RateLimit-Limit', limiter.getStats().config.maxRequests.toString());
		response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
		response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
		
		return response;
	}
	
	return resolve(event);
};

/**
 * Request logging and correlation ID middleware
 */
const loggingHandle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const correlationId = RequestContext.generateId();
	
	// Add correlation ID to event locals
	event.locals.correlationId = correlationId;
	
	// Log incoming request
	logger.debug({
		type: 'request_start',
		method: event.request.method,
		path: event.url.pathname,
		correlationId
	}, `→ ${event.request.method} ${event.url.pathname}`);

	try {
		const response = await resolve(event);
		const duration = Date.now() - startTime;
		
		// Log successful request
		logApiRequest(
			event.request.method,
			event.url.pathname,
			response.status,
			duration,
			correlationId
		);
		
		// Add correlation ID to response headers
		response.headers.set('X-Correlation-ID', correlationId);
		
		return response;
	} catch (error) {
		const duration = Date.now() - startTime;
		
		// Log error
		logApiError(
			event.request.method,
			event.url.pathname,
			error as Error,
			correlationId
		);
		
		throw error;
	} finally {
		// Cleanup
		RequestContext.delete(correlationId);
	}
};

/**
 * Error handling middleware
 */
const errorHandle: Handle = async ({ event, resolve }) => {
	try {
		return await resolve(event);
	} catch (error) {
		const errorContext = {
			type: 'unhandled_error',
			error: error instanceof Error ? {
				message: error.message,
				stack: error.stack,
				name: error.name
			} : error,
			path: event.url.pathname,
			method: event.request.method,
			correlationId: event.locals.correlationId
		};
		
		logger.error(errorContext, 'Unhandled error in request');
		
		// Send to Sentry
		captureException(error as Error, errorContext);
		
		throw error;
	}
};

/** @type {import('@sveltejs/kit').Handle} */
export const handle = sequence(
	async ({ event, resolve }) => {
		await initDb();
		return resolve(event);
	},
	corsHandle,
	rateLimitHandle,
	loggingHandle,
	errorHandle,
	authHandle
);
