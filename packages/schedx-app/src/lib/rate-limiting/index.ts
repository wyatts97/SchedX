import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import logger from '$lib/logger';

// In-memory rate limiting store (in production, use Redis)
interface RateLimitEntry {
	count: number;
	resetTime: number;
	blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limiting configuration
export interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Maximum requests per window
	blockDuration?: number; // How long to block after exceeding limit
	skipSuccessfulRequests?: boolean; // Don't count successful requests
	skipFailedRequests?: boolean; // Don't count failed requests
	keyGenerator?: (event: Parameters<RequestHandler>[0]) => string; // Custom key generator
}

// Default rate limit configurations
export const RATE_LIMITS = {
	// General API rate limiting
	general: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 100,
		blockDuration: 5 * 60 * 1000 // 5 minutes
	},
	// Login attempts
	login: {
		windowMs: 15 * 60 * 1000, // 15 minutes
		maxRequests: 5,
		blockDuration: 15 * 60 * 1000 // 15 minutes
	},
	// File uploads
	upload: {
		windowMs: 60 * 60 * 1000, // 1 hour
		maxRequests: 20,
		blockDuration: 30 * 60 * 1000 // 30 minutes
	},
	// Tweet creation
	tweets: {
		windowMs: 60 * 60 * 1000, // 1 hour
		maxRequests: 50,
		blockDuration: 10 * 60 * 1000 // 10 minutes
	},
	// Admin operations
	admin: {
		windowMs: 60 * 60 * 1000, // 1 hour
		maxRequests: 200,
		blockDuration: 5 * 60 * 1000 // 5 minutes
	}
} as const;

// Clean up expired entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now > entry.resetTime && (!entry.blockedUntil || now > entry.blockedUntil)) {
			rateLimitStore.delete(key);
		}
	}
}, 60 * 1000); // Clean up every minute

/**
 * Creates a rate limiting middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
	return (handler: RequestHandler): RequestHandler => {
		return async (event) => {
			const now = Date.now();

			// Generate rate limit key
			const key = config.keyGenerator
				? config.keyGenerator(event)
				: `${event.getClientAddress()}:${event.request.url}`;

			// Check if currently blocked
			const entry = rateLimitStore.get(key);
			if (entry?.blockedUntil && now < entry.blockedUntil) {
				const remainingTime = Math.ceil((entry.blockedUntil - now) / 1000);

				logger.warn('Rate limit blocked', {
					key,
					remainingTime,
					url: event.request.url,
					method: event.request.method
				});

				return json(
					{
						error: 'Rate limit exceeded. You are temporarily blocked.',
						retryAfter: remainingTime,
						blockedUntil: new Date(entry.blockedUntil).toISOString()
					},
					{
						status: 429,
						headers: {
							'Retry-After': remainingTime.toString(),
							'X-RateLimit-Limit': config.maxRequests.toString(),
							'X-RateLimit-Remaining': '0',
							'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
						}
					}
				);
			}

			// Check rate limit
			if (entry) {
				if (now > entry.resetTime) {
					// Reset the counter
					entry.count = 1;
					entry.resetTime = now + config.windowMs;
					delete entry.blockedUntil;
				} else if (entry.count >= config.maxRequests) {
					// Exceeded rate limit
					const blockDuration = config.blockDuration || config.windowMs;
					entry.blockedUntil = now + blockDuration;

					logger.warn('Rate limit exceeded', {
						key,
						count: entry.count,
						maxRequests: config.maxRequests,
						blockDuration,
						url: event.request.url,
						method: event.request.method
					});

					return json(
						{
							error: 'Rate limit exceeded',
							retryAfter: Math.ceil(blockDuration / 1000),
							blockedUntil: new Date(entry.blockedUntil).toISOString()
						},
						{
							status: 429,
							headers: {
								'Retry-After': Math.ceil(blockDuration / 1000).toString(),
								'X-RateLimit-Limit': config.maxRequests.toString(),
								'X-RateLimit-Remaining': '0',
								'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
							}
						}
					);
				} else {
					// Increment counter
					entry.count++;
				}
			} else {
				// First request
				rateLimitStore.set(key, {
					count: 1,
					resetTime: now + config.windowMs
				});
			}

			// Get current entry for response headers
			const currentEntry = rateLimitStore.get(key)!;
			const remaining = Math.max(0, config.maxRequests - currentEntry.count);

			// Call the handler
			const response = await handler(event);

			// Add rate limit headers to response
			if (response instanceof Response) {
				const headers = new Headers(response.headers);
				headers.set('X-RateLimit-Limit', config.maxRequests.toString());
				headers.set('X-RateLimit-Remaining', remaining.toString());
				headers.set('X-RateLimit-Reset', new Date(currentEntry.resetTime).toISOString());

				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers
				});
			}

			return response;
		};
	};
}

/**
 * Creates a rate limit middleware with predefined configuration
 */
export function rateLimit(type: keyof typeof RATE_LIMITS) {
	return createRateLimitMiddleware(RATE_LIMITS[type]);
}

/**
 * Creates a custom rate limit middleware
 */
export function customRateLimit(
	config: Partial<RateLimitConfig> & { windowMs: number; maxRequests: number }
) {
	return createRateLimitMiddleware({
		blockDuration: 5 * 60 * 1000, // Default 5 minutes
		...config
	});
}

/**
 * IP-based rate limiting (for login attempts)
 */
export function ipRateLimit(config: RateLimitConfig) {
	return createRateLimitMiddleware({
		...config,
		keyGenerator: (event) => `ip:${event.getClientAddress()}`
	});
}

/**
 * User-based rate limiting (for authenticated users)
 */
export function userRateLimit(config: RateLimitConfig) {
	return createRateLimitMiddleware({
		...config,
		keyGenerator: (event) => {
			const sessionId = event.cookies.get('admin_session');
			return sessionId ? `user:${sessionId}` : `ip:${event.getClientAddress()}`;
		}
	});
}

/**
 * Endpoint-specific rate limiting
 */
export function endpointRateLimit(config: RateLimitConfig) {
	return createRateLimitMiddleware({
		...config,
		keyGenerator: (event) => {
			const url = new URL(event.request.url);
			return `endpoint:${event.getClientAddress()}:${url.pathname}`;
		}
	});
}
