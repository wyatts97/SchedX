import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { handle as authHandle } from '$lib/server/auth';
import { initializeDatabase, ensureDefaultAdminUser } from '$lib/server/db';
import logger from '$lib/server/logger';
import { RequestContext, logApiRequest, logApiError } from '$lib/server/logging';
import { apiRateLimiter, authRateLimiter, getRateLimitIdentifier, createRateLimitResponse } from '$lib/server/rate-limiter';
import { TweetSchedulerService } from '$lib/server/tweetScheduler';
import { ThreadSchedulerService } from '$lib/server/threadScheduler';
import { RettiwtEngagementSyncService } from '$lib/server/rettiwtEngagementSync';
import { DataCleanupService } from '$lib/server/services/dataCleanupService';
import * as cron from 'node-cron';

// Initialize database and ensure default admin user
let dbInitialized = false;
let schedulerInitialized = false;
let initPromise: Promise<void> | null = null;
let localNetworkWarningLogged = false;

const initDb = async () => {
	// If already initialized, return immediately
	if (dbInitialized) {
		return;
	}
	
	// If initialization is in progress, wait for it
	if (initPromise) {
		return initPromise;
	}
	
	// Start initialization
	initPromise = (async () => {
		try {
			logger.info('Starting database initialization...');
			const startTime = Date.now();
			
			await initializeDatabase();
			await ensureDefaultAdminUser();
			dbInitialized = true;
			
			const duration = Date.now() - startTime;
			logger.info({ duration }, 'Database initialized successfully');
			
			// Start schedulers after database is ready
			if (!schedulerInitialized) {
				const tweetScheduler = TweetSchedulerService.getInstance();
				tweetScheduler.start(60000); // Check every minute
				
				const threadScheduler = ThreadSchedulerService.getInstance();
				threadScheduler.start(60000); // Check every minute
				
				const engagementSync = RettiwtEngagementSyncService.getInstance();
				engagementSync.start(); // Runs daily at 3 AM using Rettiwt-API
				
				// Schedule weekly data cleanup (Sunday at 2 AM UTC)
				cron.schedule('0 2 * * 0', async () => {
					logger.info('Starting scheduled data cleanup');
					try {
						const cleanupService = DataCleanupService.getInstance();
						const stats = await cleanupService.runGlobalCleanup();
						logger.info({
							totalRecordsDeleted: stats.totalRecordsDeleted,
							duration: stats.duration
						}, 'Scheduled data cleanup completed');
					} catch (error) {
						logger.error({ error }, 'Scheduled data cleanup failed');
					}
				}, {
					timezone: 'Etc/UTC'
				});
				
				schedulerInitialized = true;
				logger.info('Tweet, thread, engagement sync, and data cleanup schedulers initialized');
			}
		} catch (error) {
			logger.error({ error }, 'Database initialization failed');
			// Reset promise so it can be retried
			initPromise = null;
			throw error;
		}
	})();
	
	return initPromise;
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
	
	// SECURITY WARNING: Log when local network access is enabled
	if (allowLocalNetwork && !localNetworkWarningLogged) {
		logger.warn({
			type: 'security_warning',
			setting: 'ALLOW_LOCAL_NETWORK',
			message: 'Local network access is ENABLED. Session cookies may be transmitted over HTTP. Only use this for trusted home lab/self-hosted deployments.'
		}, '⚠️ SECURITY: ALLOW_LOCAL_NETWORK=true - cookies not restricted to HTTPS');
		localNetworkWarningLogged = true;
	}
	
	if (!isAllowedOrigin && origin && allowLocalNetwork) {
		const localNetworkPattern = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
		isAllowedOrigin = localNetworkPattern.test(origin);
		
		if (isAllowedOrigin) {
			logger.debug({ origin }, 'Allowing local network origin');
		}
	}
	
	// Handle preflight OPTIONS requests
	if (event.request.method === 'OPTIONS' && isAllowedOrigin && origin) {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Allow-Credentials': 'true',
				'Access-Control-Max-Age': '86400'
			}
		});
	}
	
	const response = await resolve(event);
	
	// Add CORS headers if origin is allowed
	if (isAllowedOrigin && origin) {
		response.headers.set('Access-Control-Allow-Origin', origin);
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		response.headers.set('Access-Control-Allow-Credentials', 'true');
	}
	
	return response;
};

/**
 * Rate limiting middleware
 */
const rateLimitHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Bypass rate limiting for login endpoint (handled separately if needed)
	if (path === '/api/login') {
		return resolve(event);
	}

	// Apply rate limiting to API routes
	if (path.startsWith('/api/')) {
		const identifier = getRateLimitIdentifier(event.request, event.locals.user?.id);
		
		// Use stricter rate limiting for auth endpoints (exclude /api/login)
		const limiter = path.startsWith('/api/auth')
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
		
		throw error;
	}
};

/**
 * SECURITY: Security headers middleware
 * Adds important security headers to all responses
 */
const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	
	const isProduction = process.env.NODE_ENV === 'production';
	const allowLocalNetwork = process.env.ALLOW_LOCAL_NETWORK === 'true';
	
	// X-Content-Type-Options: Prevent MIME type sniffing
	response.headers.set('X-Content-Type-Options', 'nosniff');
	
	// X-Frame-Options: Prevent clickjacking
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	
	// X-XSS-Protection: Enable XSS filtering (legacy, but still useful)
	response.headers.set('X-XSS-Protection', '1; mode=block');
	
	// Referrer-Policy: Control referrer information
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	
	// Permissions-Policy: Restrict browser features
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	
	// HSTS: Force HTTPS (only in production, not for local network)
	if (isProduction && !allowLocalNetwork) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains'
		);
	}
	
	// Content-Security-Policy: Prevent XSS and other injection attacks
	// Note: Using report-only first to avoid breaking anything
	const cspDirectives = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://preline.co", // unsafe-inline for Svelte
		"style-src 'self' 'unsafe-inline'", // unsafe-inline for Tailwind
		"img-src 'self' data: blob: https://pbs.twimg.com https://abs.twimg.com https://*.twimg.com",
		"font-src 'self' data:",
		"connect-src 'self' https://api.twitter.com https://api.x.com",
		"media-src 'self' blob: https://video.twimg.com",
		"frame-ancestors 'self'",
		"base-uri 'self'",
		"form-action 'self'"
	];
	
	// Use report-only in development to avoid breaking things
	if (isProduction) {
		response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
	} else {
		response.headers.set('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
	}
	
	return response;
};

/** @type {import('@sveltejs/kit').Handle} */
export const handle = sequence(
	async ({ event, resolve }) => {
		await initDb();
		return resolve(event);
	},
	corsHandle,
	rateLimitHandle,
	securityHeadersHandle,
	loggingHandle,
	errorHandle,
	authHandle
);
