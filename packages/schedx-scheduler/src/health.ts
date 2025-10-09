import { DatabaseClient } from '@schedx/shared-lib/backend';
import { DATABASE_PATH, DB_ENCRYPTION_KEY, AUTH_SECRET } from './config.js';
import { log } from './logger.js';

export interface HealthCheck {
	name: string;
	status: 'healthy' | 'unhealthy' | 'degraded';
	message: string;
	details?: any;
	responseTime?: number;
	lastChecked: string;
}

export interface HealthStatus {
	overall: 'healthy' | 'unhealthy' | 'degraded';
	timestamp: string;
	version: string;
	environment: string;
	checks: HealthCheck[];
	uptime: number;
}

/**
 * Check database connectivity for scheduler
 */
async function checkDatabase(): Promise<HealthCheck> {
	const startTime = Date.now();
	
	try {
		const dbClient = DatabaseClient.getInstance(DATABASE_PATH, DB_ENCRYPTION_KEY, AUTH_SECRET);
		await dbClient.connect();
		
		// Test finding due tweets (main scheduler operation)
		const testStart = Date.now();
		const dueTweets = await dbClient.findDueTweets();
		const queryTime = Date.now() - testStart;
		
		const responseTime = Date.now() - startTime;
		
		return {
			name: 'database',
			status: queryTime < 1000 ? 'healthy' : queryTime < 3000 ? 'degraded' : 'unhealthy',
			message: `Database connected successfully`,
			details: {
				queryTime: `${queryTime}ms`,
				dueTweetsFound: dueTweets.length
			},
			responseTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'database',
			status: 'unhealthy',
			message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Check scheduler configuration
 */
async function checkConfiguration(): Promise<HealthCheck> {
	const startTime = Date.now();
	
	try {
		// Check critical configuration
		const criticalConfig = ['MONGODB_URI', 'AUTH_SECRET'];
		const missingConfig = criticalConfig.filter(key => !process.env[key]);
		
		if (missingConfig.length > 0) {
			return {
				name: 'configuration',
				status: 'unhealthy',
				message: `Missing critical configuration: ${missingConfig.join(', ')}`,
				responseTime: Date.now() - startTime,
				lastChecked: new Date().toISOString()
			};
		}
		
		return {
			name: 'configuration',
			status: 'healthy',
			message: 'Configuration is valid',
			details: {
				mongodbUri: MONGODB_URI ? 'configured' : 'missing',
				authSecret: AUTH_SECRET ? 'configured' : 'missing'
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'configuration',
			status: 'unhealthy',
			message: `Configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Check memory usage
 */
async function checkMemory(): Promise<HealthCheck> {
	const startTime = Date.now();
	
	try {
		const memUsage = process.memoryUsage();
		const totalMem = memUsage.heapTotal;
		const usedMem = memUsage.heapUsed;
		
		const usagePercent = (usedMem / totalMem) * 100;
		
		let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
		if (usagePercent > 90) {
			status = 'unhealthy';
		} else if (usagePercent > 75) {
			status = 'degraded';
		}
		
		return {
			name: 'memory',
			status,
			message: `Memory usage: ${usagePercent.toFixed(1)}%`,
			details: {
				heapUsed: `${Math.round(usedMem / 1024 / 1024)}MB`,
				heapTotal: `${Math.round(totalMem / 1024 / 1024)}MB`,
				usagePercent: `${usagePercent.toFixed(1)}%`
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'memory',
			status: 'unhealthy',
			message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Check Twitter API connectivity
 */
async function checkTwitterAPI(): Promise<HealthCheck> {
	const startTime = Date.now();
	
	try {
		const dbClient = DatabaseClient.getInstance(DATABASE_PATH, DB_ENCRYPTION_KEY, AUTH_SECRET);
		await dbClient.connect();
		
		// Check if we have Twitter apps configured
		const twitterApps = await dbClient.listTwitterApps();
		const userAccounts = await dbClient.getAllUserAccounts();
		
		return {
			name: 'twitter_api',
			status: twitterApps.length > 0 ? 'healthy' : 'degraded',
			message: `Twitter API configuration: ${twitterApps.length} apps, ${userAccounts.length} accounts`,
			details: {
				twitterApps: twitterApps.length,
				userAccounts: userAccounts.length,
				configured: twitterApps.length > 0
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'twitter_api',
			status: 'unhealthy',
			message: `Twitter API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Run all health checks for scheduler
 */
export async function runHealthChecks(): Promise<HealthStatus> {
	const startTime = Date.now();
	
	log.info('Running scheduler health checks...');
	
	// Run all health checks in parallel
	const checks = await Promise.all([
		checkDatabase(),
		checkConfiguration(),
		checkMemory(),
		checkTwitterAPI()
	]);
	
	// Determine overall status
	const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
	const degradedCount = checks.filter(check => check.status === 'degraded').length;
	
	let overall: 'healthy' | 'unhealthy' | 'degraded';
	if (unhealthyCount > 0) {
		overall = 'unhealthy';
	} else if (degradedCount > 0) {
		overall = 'degraded';
	} else {
		overall = 'healthy';
	}
	
	const totalTime = Date.now() - startTime;
	
	const healthStatus: HealthStatus = {
		overall,
		timestamp: new Date().toISOString(),
		version: '1.0.0',
		environment: process.env.NODE_ENV || 'development',
		checks,
		uptime: process.uptime()
	};
	
	log.info('Scheduler health checks completed', {
		overall,
		totalTime: `${totalTime}ms`,
		unhealthyCount,
		degradedCount
	});
	
	return healthStatus;
}

/**
 * Get a simple health check for scheduler
 */
export async function getSimpleHealthCheck(): Promise<{ status: string; timestamp: string }> {
	try {
		const dbClient = DatabaseClient.getInstance(DATABASE_PATH, DB_ENCRYPTION_KEY, AUTH_SECRET);
		await dbClient.connect();
		
		return {
			status: 'ok',
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		log.error('Scheduler simple health check failed', { error });
		return {
			status: 'error',
			timestamp: new Date().toISOString()
		};
	}
}
