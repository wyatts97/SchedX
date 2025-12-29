import pino from 'pino';
import type { LoggerOptions } from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Build logger options - only reference pino-pretty in development
const loggerOptions: LoggerOptions = {
	name: 'schedx-app-server',
	level: isDevelopment ? 'debug' : 'info',
	// In production, use structured JSON logging
	formatters: {
		level: (label) => ({ level: label }),
		log: (object) => ({ ...object })
	},
	timestamp: () => `,"time":"${new Date().toISOString()}"`
};

// Only add pino-pretty transport in development (when it's available)
if (isDevelopment) {
	try {
		// Check if pino-pretty is available before using it
		require.resolve('pino-pretty');
		loggerOptions.transport = {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'yyyy-mm-dd HH:MM:ss',
				ignore: 'pid,hostname'
			}
		};
	} catch {
		// pino-pretty not available, use JSON logging
	}
}

// Create logger instance with environment-based configuration for server-side use
const logger = pino(loggerOptions);

export default logger;

// Export convenience methods
export const log = {
	debug: (message: string, extra?: object) => logger.debug(extra, message),
	info: (message: string, extra?: object) => logger.info(extra, message),
	warn: (message: string, extra?: object) => logger.warn(extra, message),
	error: (message: string, extra?: object) => logger.error(extra, message),
	fatal: (message: string, extra?: object) => logger.fatal(extra, message)
};
