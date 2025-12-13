/**
 * Standardized API Error Responses
 * Provides consistent error formatting with codes, messages, and details
 */

import { json } from '@sveltejs/kit';
import logger from './logger';

// Error codes for categorization
export enum ErrorCode {
	// Authentication errors (1xxx)
	UNAUTHORIZED = 'AUTH_001',
	INVALID_SESSION = 'AUTH_002',
	SESSION_EXPIRED = 'AUTH_003',
	INSUFFICIENT_PERMISSIONS = 'AUTH_004',

	// Validation errors (2xxx)
	VALIDATION_ERROR = 'VAL_001',
	INVALID_INPUT = 'VAL_002',
	MISSING_REQUIRED_FIELD = 'VAL_003',
	INVALID_FORMAT = 'VAL_004',
	CONTENT_TOO_LONG = 'VAL_005',
	INVALID_DATE = 'VAL_006',

	// Resource errors (3xxx)
	NOT_FOUND = 'RES_001',
	ALREADY_EXISTS = 'RES_002',
	RESOURCE_LOCKED = 'RES_003',
	RESOURCE_DELETED = 'RES_004',

	// Twitter API errors (4xxx)
	TWITTER_API_ERROR = 'TW_001',
	TWITTER_RATE_LIMITED = 'TW_002',
	TWITTER_AUTH_ERROR = 'TW_003',
	TWITTER_MEDIA_ERROR = 'TW_004',
	TWITTER_DUPLICATE = 'TW_005',
	TWITTER_FORBIDDEN = 'TW_006',

	// Database errors (5xxx)
	DATABASE_ERROR = 'DB_001',
	QUERY_FAILED = 'DB_002',
	CONSTRAINT_VIOLATION = 'DB_003',

	// Server errors (6xxx)
	INTERNAL_ERROR = 'SRV_001',
	SERVICE_UNAVAILABLE = 'SRV_002',
	TIMEOUT = 'SRV_003',

	// Rate limiting (7xxx)
	RATE_LIMITED = 'RATE_001',
	QUOTA_EXCEEDED = 'RATE_002'
}

export interface ApiError {
	error: string;
	code: ErrorCode;
	details?: string;
	field?: string;
	retryAfter?: number;
	timestamp?: string;
}

export interface ApiErrorResponse {
	success: false;
	error: ApiError;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
	code: ErrorCode,
	message: string,
	options?: {
		details?: string;
		field?: string;
		retryAfter?: number;
		status?: number;
		logError?: boolean;
		originalError?: unknown;
	}
): Response {
	const status = options?.status || getDefaultStatus(code);
	
	const errorResponse: ApiErrorResponse = {
		success: false,
		error: {
			error: message,
			code,
			details: options?.details,
			field: options?.field,
			retryAfter: options?.retryAfter,
			timestamp: new Date().toISOString()
		}
	};

	// Log error if requested or if it's a server error
	if (options?.logError !== false && (status >= 500 || options?.originalError)) {
		const errorDetails = options?.originalError instanceof Error 
			? options.originalError.message 
			: String(options?.originalError || options?.details || '');
		logger.error(`${message} [${code}]: ${errorDetails}`);
	}

	return json(errorResponse, { status });
}

/**
 * Get default HTTP status code for an error code
 */
function getDefaultStatus(code: ErrorCode): number {
	switch (code) {
		case ErrorCode.UNAUTHORIZED:
		case ErrorCode.INVALID_SESSION:
		case ErrorCode.SESSION_EXPIRED:
			return 401;

		case ErrorCode.INSUFFICIENT_PERMISSIONS:
		case ErrorCode.TWITTER_FORBIDDEN:
			return 403;

		case ErrorCode.NOT_FOUND:
		case ErrorCode.RESOURCE_DELETED:
			return 404;

		case ErrorCode.ALREADY_EXISTS:
		case ErrorCode.RESOURCE_LOCKED:
			return 409;

		case ErrorCode.VALIDATION_ERROR:
		case ErrorCode.INVALID_INPUT:
		case ErrorCode.MISSING_REQUIRED_FIELD:
		case ErrorCode.INVALID_FORMAT:
		case ErrorCode.CONTENT_TOO_LONG:
		case ErrorCode.INVALID_DATE:
			return 400;

		case ErrorCode.RATE_LIMITED:
		case ErrorCode.TWITTER_RATE_LIMITED:
		case ErrorCode.QUOTA_EXCEEDED:
			return 429;

		case ErrorCode.SERVICE_UNAVAILABLE:
			return 503;

		case ErrorCode.TIMEOUT:
			return 504;

		default:
			return 500;
	}
}

// Pre-built error responses for common scenarios
export const Errors = {
	unauthorized: () => createErrorResponse(
		ErrorCode.UNAUTHORIZED,
		'Authentication required',
		{ details: 'Please log in to access this resource' }
	),

	invalidSession: () => createErrorResponse(
		ErrorCode.INVALID_SESSION,
		'Invalid or expired session',
		{ details: 'Please log in again' }
	),

	notFound: (resource: string) => createErrorResponse(
		ErrorCode.NOT_FOUND,
		`${resource} not found`,
		{ details: `The requested ${resource.toLowerCase()} does not exist or has been deleted` }
	),

	validationError: (message: string, field?: string) => createErrorResponse(
		ErrorCode.VALIDATION_ERROR,
		message,
		{ field }
	),

	twitterApiError: (message: string, details?: string) => createErrorResponse(
		ErrorCode.TWITTER_API_ERROR,
		`Twitter API Error: ${message}`,
		{ details }
	),

	twitterRateLimited: (resetAt?: Date) => createErrorResponse(
		ErrorCode.TWITTER_RATE_LIMITED,
		'Twitter rate limit exceeded',
		{ 
			details: resetAt 
				? `Rate limit will reset at ${resetAt.toISOString()}` 
				: 'Please wait before trying again',
			retryAfter: resetAt ? Math.ceil((resetAt.getTime() - Date.now()) / 1000) : 900
		}
	),

	twitterAuthError: (accountUsername?: string) => createErrorResponse(
		ErrorCode.TWITTER_AUTH_ERROR,
		'Twitter authentication failed',
		{ 
			details: accountUsername 
				? `Please reconnect your Twitter account @${accountUsername}` 
				: 'Please reconnect your Twitter account'
		}
	),

	twitterMediaError: (message: string) => createErrorResponse(
		ErrorCode.TWITTER_MEDIA_ERROR,
		'Media upload failed',
		{ details: message }
	),

	twitterDuplicate: () => createErrorResponse(
		ErrorCode.TWITTER_DUPLICATE,
		'Duplicate tweet detected',
		{ details: 'Twitter does not allow posting duplicate content. Please modify your tweet.' }
	),

	rateLimited: (retryAfter?: number) => createErrorResponse(
		ErrorCode.RATE_LIMITED,
		'Too many requests',
		{ 
			details: 'Please slow down and try again later',
			retryAfter: retryAfter || 60
		}
	),

	internalError: (originalError?: unknown) => createErrorResponse(
		ErrorCode.INTERNAL_ERROR,
		'An unexpected error occurred',
		{ 
			details: 'Please try again later. If the problem persists, contact support.',
			originalError,
			logError: true
		}
	),

	databaseError: (originalError?: unknown) => createErrorResponse(
		ErrorCode.DATABASE_ERROR,
		'Database operation failed',
		{ 
			details: 'Please try again later',
			originalError,
			logError: true
		}
	)
};

/**
 * Parse Twitter API error and return appropriate error response
 */
export function parseTwitterError(error: unknown): Response {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		
		// Rate limit
		if (message.includes('rate limit') || message.includes('too many requests')) {
			return Errors.twitterRateLimited();
		}
		
		// Duplicate tweet
		if (message.includes('duplicate') || message.includes('already posted')) {
			return Errors.twitterDuplicate();
		}
		
		// Auth error
		if (message.includes('unauthorized') || message.includes('authentication') || message.includes('token')) {
			return Errors.twitterAuthError();
		}
		
		// Forbidden
		if (message.includes('forbidden') || message.includes('suspended')) {
			return createErrorResponse(
				ErrorCode.TWITTER_FORBIDDEN,
				'Action not allowed',
				{ details: error.message }
			);
		}
		
		// Media error
		if (message.includes('media') || message.includes('upload')) {
			return Errors.twitterMediaError(error.message);
		}
		
		// Generic Twitter error
		return Errors.twitterApiError(error.message);
	}
	
	return Errors.twitterApiError('Unknown error occurred');
}
