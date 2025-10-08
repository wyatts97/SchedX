/**
 * Sentry Error Tracking Integration
 * Optional: Install with `npm install @sentry/node @sentry/profiling-node`
 */

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'development';
const NODE_ENV = process.env.NODE_ENV || 'development';

let Sentry: any = null;
let sentryEnabled = false;

/**
 * Initialize Sentry for error tracking
 */
export async function initSentry() {
	if (!SENTRY_DSN) {
		console.log('Sentry DSN not configured, error tracking disabled');
		return;
	}

	try {
		// Dynamically import Sentry (optional dependency)
		Sentry = await import('@sentry/node');
		const { nodeProfilingIntegration } = await import('@sentry/profiling-node');

		Sentry.init({
			dsn: SENTRY_DSN,
			environment: SENTRY_ENVIRONMENT,
			
			// Performance monitoring
			tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
			
			// Profiling
			profilesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0,
			
			integrations: [
				nodeProfilingIntegration(),
				// Add HTTP integration for tracking requests
				new Sentry.Integrations.Http({ tracing: true })
			],
			
			// Filter out sensitive data
			beforeSend(event: any, hint: any) {
				// Remove sensitive headers
				if (event.request?.headers) {
					delete event.request.headers['authorization'];
					delete event.request.headers['cookie'];
				}
				
				// Remove sensitive query params
				if (event.request?.query_string) {
					const params = new URLSearchParams(event.request.query_string);
					if (params.has('token')) params.delete('token');
					if (params.has('secret')) params.delete('secret');
					event.request.query_string = params.toString();
				}
				
				return event;
			},
			
			// Ignore certain errors
			ignoreErrors: [
				'NetworkError',
				'AbortError',
				'Non-Error promise rejection',
				// Add other errors to ignore
			],
			
			// Release tracking
			release: process.env.npm_package_version || '1.0.0'
		});

		sentryEnabled = true;
		console.log(`✅ Sentry initialized for environment: ${SENTRY_ENVIRONMENT}`);
	} catch (error) {
		console.log('⚠️  Sentry packages not installed. Install with: npm install @sentry/node @sentry/profiling-node');
		console.log('   Error tracking will be disabled.');
	}
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, any>) {
	if (!sentryEnabled || !Sentry) return;
	
	Sentry.captureException(error, {
		extra: context
	});
}

/**
 * Capture message
 */
export function captureMessage(
	message: string, 
	level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info', 
	context?: Record<string, any>
) {
	if (!sentryEnabled || !Sentry) return;
	
	Sentry.captureMessage(message, {
		level,
		extra: context
	});
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; username?: string; email?: string }) {
	if (!sentryEnabled || !Sentry) return;
	
	Sentry.setUser({
		id: user.id,
		username: user.username,
		email: user.email
	});
}

/**
 * Clear user context
 */
export function clearUser() {
	if (!sentryEnabled || !Sentry) return;
	Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
	if (!sentryEnabled || !Sentry) return;
	
	Sentry.addBreadcrumb({
		message,
		category,
		data,
		level: 'info'
	});
}

/**
 * Start transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
	if (!sentryEnabled || !Sentry) return null;
	
	return Sentry.startTransaction({
		name,
		op
	});
}
