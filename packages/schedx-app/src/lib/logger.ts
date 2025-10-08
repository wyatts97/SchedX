import pino from 'pino';
import { dev } from '$app/environment';
import { browser } from '$app/environment';

// Enhanced logger configuration with structured logging
const logger = pino({
	name: 'schedx-app',
	level: dev ? 'debug' : 'info',
	transport: dev
		? {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'yyyy-mm-dd HH:MM:ss',
					ignore: 'pid,hostname',
					messageFormat: '{levelLabel} - {msg}'
				}
			}
		: undefined,
	// Enhanced formatters for production
	formatters: {
		level: (label) => ({ level: label }),
		log: (object) => {
			// Add context information
			const context: any = {
				...object,
				environment: dev ? 'development' : 'production',
				timestamp: new Date().toISOString()
			};

			// Add browser context if available
			if (browser && typeof window !== 'undefined') {
				context.browser = {
					userAgent: window.navigator.userAgent,
					url: window.location.href,
					referrer: document.referrer || undefined,
					viewport: {
						width: window.innerWidth,
						height: window.innerHeight
					}
				};
			}

			return context;
		}
	},
	timestamp: () => `,"time":"${new Date().toISOString()}"`
});

// Enhanced logging methods with automatic context
const createEnhancedLogger = () => {
	const addContext = (extra?: object) => {
		const baseContext = {
			sessionId:
				browser && typeof window !== 'undefined'
					? sessionStorage.getItem('sessionId') || 'anonymous'
					: 'server',
			userId:
				browser && typeof window !== 'undefined'
					? localStorage.getItem('userId') || 'anonymous'
					: 'server'
		};

		return { ...baseContext, ...extra };
	};

	return {
		debug: (message: string, extra?: object) => {
			logger.debug(addContext(extra), message);
		},
		info: (message: string, extra?: object) => {
			logger.info(addContext(extra), message);
		},
		warn: (message: string, extra?: object) => {
			logger.warn(addContext(extra), message);
		},
		error: (message: string, extra?: object) => {
			const errorContext: any = addContext(extra);

			// Add stack trace if error object is provided
			if (extra && typeof extra === 'object' && 'error' in extra) {
				const error = extra.error;
				if (error instanceof Error) {
					errorContext.stack = error.stack;
					errorContext.errorName = error.name;
				}
			}

			logger.error(errorContext, message);

			// In development, also log to console for easier debugging
			if (dev && browser) {
				// Use structured logging instead of console.error
				logger.error(errorContext, `[SchedX Error] ${message}`);
			}
		},
		fatal: (message: string, extra?: object) => {
			const fatalContext = addContext(extra);
			logger.fatal(fatalContext, message);

			// Always log fatal errors to console
			if (browser) {
				// Use structured logging instead of console.error
				logger.fatal(fatalContext, `[SchedX Fatal] ${message}`);
			}
		},
		// Performance logging
		performance: (operation: string, duration: number, extra?: object) => {
			logger.info(
				addContext({
					...extra,
					operation,
					duration,
					performanceMetric: true
				}),
				`Performance: ${operation} completed in ${duration}ms`
			);
		},
		// User action logging
		userAction: (action: string, extra?: object) => {
			logger.info(
				addContext({
					...extra,
					action,
					userAction: true
				}),
				`User action: ${action}`
			);
		},
		// API call logging
		apiCall: (method: string, url: string, status: number, duration: number, extra?: object) => {
			const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
			logger[level](
				addContext({
					...extra,
					method,
					url,
					status,
					duration,
					apiCall: true
				}),
				`API ${method} ${url} - ${status} (${duration}ms)`
			);
		}
	};
};

const enhancedLogger = createEnhancedLogger();

export default enhancedLogger;

// Export the original pino logger for direct access if needed
export const rawLogger = logger;

// Export convenience methods (backward compatibility)
export const log = {
	debug: enhancedLogger.debug,
	info: enhancedLogger.info,
	warn: enhancedLogger.warn,
	error: enhancedLogger.error,
	fatal: enhancedLogger.fatal
};

// Performance measurement utility
export const measurePerformance = async <T>(
	operation: string,
	fn: () => Promise<T> | T,
	extra?: object
): Promise<T> => {
	const start = performance.now();
	try {
		const result = await fn();
		const duration = performance.now() - start;
		enhancedLogger.performance(operation, duration, extra);
		return result;
	} catch (error) {
		const duration = performance.now() - start;
		enhancedLogger.error(`Performance: ${operation} failed after ${duration}ms`, {
			...extra,
			error,
			operation,
			duration,
			failed: true
		});
		throw error;
	}
};

// Initialize session ID for tracking
if (browser && typeof window !== 'undefined' && !sessionStorage.getItem('sessionId')) {
	sessionStorage.setItem(
		'sessionId',
		`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	);
}
