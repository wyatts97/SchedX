/**
 * Rate Limiting Implementation
 * Protects API endpoints from abuse
 */

import logger from './logger';

interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Max requests per window
	message?: string;
	skipSuccessfulRequests?: boolean;
	skipFailedRequests?: boolean;
}

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

class RateLimiter {
	private store = new Map<string, RateLimitEntry>();
	private config: Required<RateLimitConfig>;

	constructor(config: RateLimitConfig) {
		this.config = {
			windowMs: config.windowMs,
			maxRequests: config.maxRequests,
			message: config.message || 'Too many requests, please try again later.',
			skipSuccessfulRequests: config.skipSuccessfulRequests || false,
			skipFailedRequests: config.skipFailedRequests || false
		};

		// Cleanup old entries every minute
		setInterval(() => this.cleanup(), 60000);
	}

	/**
	 * Check if request should be rate limited
	 */
	check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
		const now = Date.now();
		const entry = this.store.get(identifier);

		// No entry or expired entry
		if (!entry || now > entry.resetTime) {
			const resetTime = now + this.config.windowMs;
			this.store.set(identifier, { count: 1, resetTime });
			return {
				allowed: true,
				remaining: this.config.maxRequests - 1,
				resetTime
			};
		}

		// Increment count
		entry.count++;

		// Check if limit exceeded
		if (entry.count > this.config.maxRequests) {
			logger.warn({
				type: 'rate_limit_exceeded',
				identifier,
				count: entry.count,
				limit: this.config.maxRequests
			}, 'Rate limit exceeded');

			return {
				allowed: false,
				remaining: 0,
				resetTime: entry.resetTime
			};
		}

		return {
			allowed: true,
			remaining: this.config.maxRequests - entry.count,
			resetTime: entry.resetTime
		};
	}

	/**
	 * Record request result (for conditional rate limiting)
	 */
	recordResult(identifier: string, success: boolean) {
		if (
			(success && this.config.skipSuccessfulRequests) ||
			(!success && this.config.skipFailedRequests)
		) {
			const entry = this.store.get(identifier);
			if (entry && entry.count > 0) {
				entry.count--;
			}
		}
	}

	/**
	 * Reset rate limit for identifier
	 */
	reset(identifier: string) {
		this.store.delete(identifier);
	}

	/**
	 * Cleanup expired entries
	 */
	private cleanup() {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, entry] of this.store.entries()) {
			if (now > entry.resetTime) {
				this.store.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			logger.debug({ cleaned }, 'Rate limiter cleanup completed');
		}
	}

	/**
	 * Get current stats
	 */
	getStats() {
		return {
			totalEntries: this.store.size,
			config: this.config
		};
	}
}

// Create rate limiters for different endpoints
export const apiRateLimiter = new RateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100')
});

export const authRateLimiter = new RateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: 5,
	message: 'Too many authentication attempts, please try again later.'
});

export const tweetPostRateLimiter = new RateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 10,
	message: 'Tweet posting rate limit exceeded. Please wait before posting again.'
});

/**
 * SECURITY: Trusted proxy configuration
 * Only trust X-Forwarded-For header from these sources
 * Set TRUSTED_PROXIES env var as comma-separated list of IPs/CIDRs
 */
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',').map(p => p.trim());

function isPrivateIP(ip: string): boolean {
	// Check if IP is from a private/trusted network
	return (
		ip === '127.0.0.1' ||
		ip === '::1' ||
		ip.startsWith('10.') ||
		ip.startsWith('192.168.') ||
		/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
	);
}

/**
 * Get identifier for rate limiting (IP or user ID)
 * SECURITY: Only trusts X-Forwarded-For from configured proxies
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
	// Use user ID if authenticated
	if (userId) {
		return `user:${userId}`;
	}

	// Get the real client IP with proxy trust validation
	const forwarded = request.headers.get('x-forwarded-for');
	const realIp = request.headers.get('x-real-ip');
	const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
	
	let ip = 'unknown';
	
	// Priority: CF-Connecting-IP (if using Cloudflare) > X-Real-IP > X-Forwarded-For
	if (cfConnectingIp) {
		ip = cfConnectingIp.trim();
	} else if (realIp) {
		ip = realIp.trim();
	} else if (forwarded) {
		// SECURITY: Only use X-Forwarded-For if we're behind a trusted proxy
		// The rightmost IP that's not a trusted proxy is the client
		const ips = forwarded.split(',').map(p => p.trim());
		
		// In development/Docker, trust private IPs
		const trustPrivate = process.env.NODE_ENV !== 'production' || process.env.DOCKER === 'true';
		
		// Find the first non-trusted IP from the right
		for (let i = ips.length - 1; i >= 0; i--) {
			const currentIp = ips[i];
			const isTrusted = TRUSTED_PROXIES.includes(currentIp) || (trustPrivate && isPrivateIP(currentIp));
			
			if (!isTrusted) {
				ip = currentIp;
				break;
			}
		}
		
		// If all IPs were trusted, use the leftmost (original client)
		if (ip === 'unknown' && ips.length > 0) {
			ip = ips[0];
		}
	}
	
	return `ip:${ip}`;
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(resetTime: number, message?: string) {
	const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
	
	return new Response(
		JSON.stringify({
			error: message || 'Too many requests',
			retryAfter
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': retryAfter.toString(),
				'X-RateLimit-Reset': new Date(resetTime).toISOString()
			}
		}
	);
}

export default RateLimiter;
