import { getDbInstance } from '$lib/server/db';
import { getEnvironmentConfig } from '$lib/server/env';
import logger from '$lib/logger';

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
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<HealthCheck> {
	const startTime = Date.now();

	try {
		const db = getDbInstance();
		const database = await db.connect();

		// Test basic connectivity
		await database.admin().ping();

		// Test query performance
		const testStart = Date.now();
		await database.collection('tweets').findOne({}, { limit: 1 });
		const queryTime = Date.now() - testStart;

		// Get database stats
		const stats = await database.stats();

		const responseTime = Date.now() - startTime;

		return {
			name: 'database',
			status: queryTime < 1000 ? 'healthy' : queryTime < 3000 ? 'degraded' : 'unhealthy',
			message: `Database connected successfully`,
			details: {
				queryTime: `${queryTime}ms`,
				collections: stats.collections,
				documents: stats.objects,
				dataSize: `${Math.round(stats.dataSize / 1024 / 1024)}MB`,
				indexSize: `${Math.round(stats.indexSize / 1024 / 1024)}MB`
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
 * Check environment configuration
 */
async function checkEnvironment(): Promise<HealthCheck> {
	const startTime = Date.now();

	try {
		const config = getEnvironmentConfig();

		// Check critical environment variables
		const criticalVars = ['AUTH_SECRET', 'DB_ENCRYPTION_KEY', 'MONGODB_URI'];
		const missingVars = criticalVars.filter((varName) => !config[varName as keyof typeof config]);

		if (missingVars.length > 0) {
			return {
				name: 'environment',
				status: 'unhealthy',
				message: `Missing critical environment variables: ${missingVars.join(', ')}`,
				responseTime: Date.now() - startTime,
				lastChecked: new Date().toISOString()
			};
		}

		return {
			name: 'environment',
			status: 'healthy',
			message: 'Environment configuration is valid',
			details: {
				nodeEnv: config.NODE_ENV,
				port: config.PORT,
				origin: config.ORIGIN,
				maxUploadSize: `${Math.round(config.MAX_UPLOAD_SIZE / 1024 / 1024)}MB`
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'environment',
			status: 'unhealthy',
			message: `Environment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Check file system access
 */
async function checkFileSystem(): Promise<HealthCheck> {
	const startTime = Date.now();

	try {
		const fs = await import('fs');
		const path = await import('path');

		// Check uploads directory
		const uploadsDir = path.join(process.cwd(), 'uploads');
		const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');

		// Ensure directories exist
		if (!fs.existsSync(uploadsDir)) {
			fs.mkdirSync(uploadsDir, { recursive: true });
		}
		if (!fs.existsSync(avatarsDir)) {
			fs.mkdirSync(avatarsDir, { recursive: true });
		}

		// Test write access
		const testFile = path.join(uploadsDir, 'health-check-test.txt');
		fs.writeFileSync(testFile, 'health check test');
		fs.unlinkSync(testFile);

		return {
			name: 'filesystem',
			status: 'healthy',
			message: 'File system access is working',
			details: {
				uploadsDir: uploadsDir,
				avatarsDir: avatarsDir,
				writable: true
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'filesystem',
			status: 'unhealthy',
			message: `File system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
		const externalMem = memUsage.external;
		const rssMem = memUsage.rss;

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
				external: `${Math.round(externalMem / 1024 / 1024)}MB`,
				rss: `${Math.round(rssMem / 1024 / 1024)}MB`,
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
 * Check external dependencies (Twitter API)
 */
async function checkExternalDependencies(): Promise<HealthCheck> {
	const startTime = Date.now();

	try {
		const db = getDbInstance();
		const database = await db.connect();

		// Check if we have any Twitter apps configured
		const twitterApps = await database.collection('twitter_apps').countDocuments();
		const userAccounts = await database.collection('accounts').countDocuments();

		return {
			name: 'external_dependencies',
			status: twitterApps > 0 ? 'healthy' : 'degraded',
			message: `External dependencies configured: ${twitterApps} Twitter apps, ${userAccounts} user accounts`,
			details: {
				twitterApps,
				userAccounts,
				configured: twitterApps > 0
			},
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	} catch (error) {
		return {
			name: 'external_dependencies',
			status: 'unhealthy',
			message: `External dependencies check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			responseTime: Date.now() - startTime,
			lastChecked: new Date().toISOString()
		};
	}
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthStatus> {
	const startTime = Date.now();

	logger.info('Running health checks...');

	// Run all health checks in parallel
	const checks = await Promise.all([
		checkDatabase(),
		checkEnvironment(),
		checkFileSystem(),
		checkMemory(),
		checkExternalDependencies()
	]);

	// Determine overall status
	const unhealthyCount = checks.filter((check) => check.status === 'unhealthy').length;
	const degradedCount = checks.filter((check) => check.status === 'degraded').length;

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
		version: process.env.npm_package_version || '1.0.0',
		environment: process.env.NODE_ENV || 'development',
		checks,
		uptime: process.uptime()
	};

	logger.info('Health checks completed', {
		overall,
		totalTime: `${totalTime}ms`,
		unhealthyCount,
		degradedCount
	});

	return healthStatus;
}

/**
 * Get a simple health check (for load balancers)
 */
export async function getSimpleHealthCheck(): Promise<{ status: string; timestamp: string }> {
	try {
		const db = getDbInstance();
		await db.connect();
		await db.connect().then((db) => db.admin().ping());

		return {
			status: 'ok',
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		logger.error('Simple health check failed', { error });
		return {
			status: 'error',
			timestamp: new Date().toISOString()
		};
	}
}
