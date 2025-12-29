import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDbInstance } from '$lib/server/db';
import logger from '$lib/server/logger';
import { existsSync, statfsSync } from 'fs';
import os from 'os';

interface HealthCheckResult {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	uptime: number;
	checks: {
		database: {
			status: 'ok' | 'error';
			latency?: number;
			error?: string;
		};
		disk: {
			status: 'ok' | 'warning' | 'error';
			availableGB?: number;
			usedPercent?: number;
			error?: string;
		};
		memory: {
			status: 'ok' | 'warning' | 'error';
			usedMB: number;
			totalMB: number;
			usedPercent: number;
		};
	};
}

/**
 * Health check endpoint
 * Used by Docker health checks and monitoring
 */
export const GET: RequestHandler = async () => {
	const startTime = Date.now();
	const checks: HealthCheckResult['checks'] = {
		database: { status: 'ok' },
		disk: { status: 'ok' },
		memory: { status: 'ok', usedMB: 0, totalMB: 0, usedPercent: 0 }
	};

	// Check database connectivity
	try {
		const dbStartTime = Date.now();
		const db = getDbInstance();
		
		// Simple query to verify database is responsive
		(db as any)['db'].queryOne('SELECT 1 as test');
		
		checks.database.latency = Date.now() - dbStartTime;
		checks.database.status = 'ok';
	} catch (error) {
		logger.error({ error }, 'Database health check failed');
		checks.database.status = 'error';
		checks.database.error = error instanceof Error ? error.message : 'Unknown error';
	}

	// Check disk space
	try {
		const uploadsDir = process.env.DOCKER === 'true'
			? '/app/packages/schedx-app/uploads'
			: process.cwd();
		
		if (existsSync(uploadsDir)) {
			const stats = statfsSync(uploadsDir);
			const availableBytes = stats.bavail * stats.bsize;
			const totalBytes = stats.blocks * stats.bsize;
			const usedBytes = totalBytes - availableBytes;
			const usedPercent = (usedBytes / totalBytes) * 100;
			
			checks.disk.availableGB = Math.round((availableBytes / (1024 ** 3)) * 100) / 100;
			checks.disk.usedPercent = Math.round(usedPercent * 100) / 100;
			
			// Warn if disk usage is above 80%, error if above 95%
			if (usedPercent > 95) {
				checks.disk.status = 'error';
			} else if (usedPercent > 80) {
				checks.disk.status = 'warning';
			} else {
				checks.disk.status = 'ok';
			}
		}
	} catch (error) {
		logger.warn({ error }, 'Disk space check failed');
		checks.disk.status = 'error';
		checks.disk.error = error instanceof Error ? error.message : 'Unknown error';
	}

	// Check memory usage
	try {
		const totalMem = os.totalmem();
		const freeMem = os.freemem();
		const usedMem = totalMem - freeMem;
		const usedPercent = (usedMem / totalMem) * 100;
		
		checks.memory.usedMB = Math.round(usedMem / (1024 * 1024));
		checks.memory.totalMB = Math.round(totalMem / (1024 * 1024));
		checks.memory.usedPercent = Math.round(usedPercent * 100) / 100;
		
		// Warn if memory usage is above 85%, error if above 95%
		if (usedPercent > 95) {
			checks.memory.status = 'error';
		} else if (usedPercent > 85) {
			checks.memory.status = 'warning';
		} else {
			checks.memory.status = 'ok';
		}
	} catch (error) {
		logger.error({ error }, 'Memory check failed');
		checks.memory.status = 'error';
	}

	// Determine overall status
	let overallStatus: HealthCheckResult['status'] = 'healthy';
	
	if (checks.database.status === 'error') {
		overallStatus = 'unhealthy';
	} else if (
		checks.disk.status === 'error' ||
		checks.memory.status === 'error'
	) {
		overallStatus = 'degraded';
	} else if (
		checks.disk.status === 'warning' ||
		checks.memory.status === 'warning'
	) {
		overallStatus = 'degraded';
	}

	const result: HealthCheckResult = {
		status: overallStatus,
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		checks
	};

	// Return appropriate HTTP status code based on health
	const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
	
	return json(result, { status: httpStatus });
};
