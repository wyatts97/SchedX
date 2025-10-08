import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import logger from '$lib/logger';

/**
 * Creates a validation middleware for API routes
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
	return (
		handler: (data: T, event: Parameters<RequestHandler>[0]) => ReturnType<RequestHandler>
	): RequestHandler => {
		return async (event) => {
			try {
				let data: unknown;

				// Handle different content types
				const contentType = event.request.headers.get('content-type') || '';

				if (contentType.includes('application/json')) {
					data = await event.request.json();
				} else if (
					contentType.includes('multipart/form-data') ||
					contentType.includes('application/x-www-form-urlencoded')
				) {
					const formData = await event.request.formData();
					data = Object.fromEntries(formData.entries());
				} else {
					// For GET requests or other methods without body
					const url = new URL(event.request.url);
					data = Object.fromEntries(url.searchParams.entries());
				}

				// Validate the data
				const validationResult = schema.safeParse(data);

				if (!validationResult.success) {
					const errors = validationResult.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message
					}));

					logger.warn('Validation failed', {
						errors,
						url: event.request.url,
						method: event.request.method
					});

					return json(
						{
							error: 'Validation failed',
							details: errors
						},
						{ status: 400 }
					);
				}

				// Call the handler with validated data
				return await handler(validationResult.data, event);
			} catch (error) {
				logger.error('Validation middleware error', { error });
				return json(
					{
						error: 'Invalid request format'
					},
					{ status: 400 }
				);
			}
		};
	};
}

/**
 * Creates a query parameter validation middleware
 */
export function createQueryValidationMiddleware<T>(schema: z.ZodSchema<T>) {
	return (
		handler: (data: T, event: Parameters<RequestHandler>[0]) => ReturnType<RequestHandler>
	): RequestHandler => {
		return async (event) => {
			try {
				const url = new URL(event.request.url);
				const queryData = Object.fromEntries(url.searchParams.entries());

				// Validate query parameters
				const validationResult = schema.safeParse(queryData);

				if (!validationResult.success) {
					const errors = validationResult.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message
					}));

					logger.warn('Query validation failed', {
						errors,
						url: event.request.url,
						method: event.request.method
					});

					return json(
						{
							error: 'Invalid query parameters',
							details: errors
						},
						{ status: 400 }
					);
				}

				// Call the handler with validated data
				return await handler(validationResult.data, event);
			} catch (error) {
				logger.error('Query validation middleware error', { error });
				return json(
					{
						error: 'Invalid query parameters'
					},
					{ status: 400 }
				);
			}
		};
	};
}

/**
 * Creates a file upload validation middleware
 */
export function createFileValidationMiddleware<T>(schema: z.ZodSchema<T>) {
	return (
		handler: (data: T, event: Parameters<RequestHandler>[0]) => ReturnType<RequestHandler>
	): RequestHandler => {
		return async (event) => {
			try {
				const formData = await event.request.formData();

				// Convert FormData to object for validation
				const data: any = {};
				for (const [key, value] of formData.entries()) {
					data[key] = value;
				}

				// Validate the data
				const validationResult = schema.safeParse(data);

				if (!validationResult.success) {
					const errors = validationResult.error.errors.map((err) => ({
						field: err.path.join('.'),
						message: err.message
					}));

					logger.warn('File validation failed', {
						errors,
						url: event.request.url,
						method: event.request.method
					});

					return json(
						{
							error: 'File validation failed',
							details: errors
						},
						{ status: 400 }
					);
				}

				// Call the handler with validated data
				return await handler(validationResult.data, event);
			} catch (error) {
				logger.error('File validation middleware error', { error });
				return json(
					{
						error: 'Invalid file upload'
					},
					{ status: 400 }
				);
			}
		};
	};
}

/**
 * Rate limiting helper (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function createRateLimitMiddleware(
	windowMs: number = 15 * 60 * 1000, // 15 minutes
	maxRequests: number = 100
) {
	return (handler: RequestHandler): RequestHandler => {
		return async (event) => {
			const clientIP = event.getClientAddress();
			const now = Date.now();
			const key = `${clientIP}:${event.request.url}`;

			// Clean up expired entries
			for (const [k, v] of rateLimitMap.entries()) {
				if (now > v.resetTime) {
					rateLimitMap.delete(k);
				}
			}

			// Check current rate limit
			const current = rateLimitMap.get(key);
			if (current) {
				if (now > current.resetTime) {
					// Reset the counter
					rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
				} else if (current.count >= maxRequests) {
					logger.warn('Rate limit exceeded', {
						clientIP,
						url: event.request.url,
						count: current.count,
						maxRequests
					});

					return json(
						{
							error: 'Rate limit exceeded',
							retryAfter: Math.ceil((current.resetTime - now) / 1000)
						},
						{
							status: 429,
							headers: {
								'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString()
							}
						}
					);
				} else {
					// Increment counter
					current.count++;
				}
			} else {
				// First request
				rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
			}

			// Call the handler
			return await handler(event);
		};
	};
}
