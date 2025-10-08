import pino from 'pino';
import { randomUUID } from 'crypto';

// Get log level from environment
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Create enhanced Pino logger with structured logging
 */
export const logger = pino({
	level: LOG_LEVEL,
	formatters: {
		level: (label) => {
			return { level: label };
		},
		bindings: (bindings) => {
			return {
				pid: bindings.pid,
				hostname: bindings.hostname,
				node_version: process.version
			};
		}
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	...(NODE_ENV === 'development'
		? {
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'HH:MM:ss Z',
						ignore: 'pid,hostname'
					}
				}
		  }
		: {})
});

/**
 * Request context for correlation IDs
 */
export class RequestContext {
	private static contexts = new Map<string, string>();

	static set(requestId: string, correlationId: string) {
		this.contexts.set(requestId, correlationId);
	}

	static get(requestId: string): string | undefined {
		return this.contexts.get(requestId);
	}

	static delete(requestId: string) {
		this.contexts.delete(requestId);
	}

	static generateId(): string {
		return randomUUID();
	}
}

/**
 * Create child logger with correlation ID
 */
export function createRequestLogger(correlationId?: string) {
	const id = correlationId || RequestContext.generateId();
	return logger.child({ correlationId: id });
}

/**
 * Log with context
 */
export function logWithContext(
	level: 'info' | 'warn' | 'error' | 'debug',
	message: string,
	context?: Record<string, any>
) {
	logger[level]({ ...context, timestamp: new Date().toISOString() }, message);
}

/**
 * Log API request
 */
export function logApiRequest(
	method: string,
	path: string,
	statusCode: number,
	duration: number,
	correlationId?: string
) {
	logger.info({
		type: 'api_request',
		method,
		path,
		statusCode,
		duration,
		correlationId
	}, `${method} ${path} ${statusCode} - ${duration}ms`);
}

/**
 * Log API error
 */
export function logApiError(
	method: string,
	path: string,
	error: Error,
	correlationId?: string
) {
	logger.error({
		type: 'api_error',
		method,
		path,
		error: {
			message: error.message,
			stack: error.stack,
			name: error.name
		},
		correlationId
	}, `API Error: ${method} ${path} - ${error.message}`);
}

/**
 * Log database operation
 */
export function logDbOperation(
	operation: string,
	collection: string,
	duration: number,
	success: boolean,
	error?: Error
) {
	const logData = {
		type: 'db_operation',
		operation,
		collection,
		duration,
		success
	};

	if (error) {
		logger.error({ ...logData, error: error.message }, `DB Error: ${operation} on ${collection}`);
	} else {
		logger.debug(logData, `DB: ${operation} on ${collection} - ${duration}ms`);
	}
}

/**
 * Log authentication event
 */
export function logAuthEvent(
	event: 'login' | 'logout' | 'token_refresh' | 'auth_failure',
	userId?: string,
	details?: Record<string, any>
) {
	logger.info({
		type: 'auth_event',
		event,
		userId,
		...details
	}, `Auth: ${event}${userId ? ` - User: ${userId}` : ''}`);
}

/**
 * Log tweet operation
 */
export function logTweetOperation(
	operation: 'create' | 'update' | 'delete' | 'post' | 'schedule',
	tweetId: string,
	userId: string,
	success: boolean,
	error?: Error
) {
	const logData = {
		type: 'tweet_operation',
		operation,
		tweetId,
		userId,
		success
	};

	if (error) {
		logger.error({ ...logData, error: error.message }, `Tweet ${operation} failed: ${error.message}`);
	} else {
		logger.info(logData, `Tweet ${operation} successful`);
	}
}

/**
 * Log security event
 */
export function logSecurityEvent(
	event: string,
	severity: 'low' | 'medium' | 'high' | 'critical',
	details: Record<string, any>
) {
	logger.warn({
		type: 'security_event',
		event,
		severity,
		...details
	}, `Security: ${event}`);
}

/**
 * Log performance metric
 */
export function logPerformance(
	metric: string,
	value: number,
	unit: 'ms' | 'bytes' | 'count',
	tags?: Record<string, string>
) {
	logger.debug({
		type: 'performance',
		metric,
		value,
		unit,
		tags
	}, `Performance: ${metric} = ${value}${unit}`);
}

export default logger;
