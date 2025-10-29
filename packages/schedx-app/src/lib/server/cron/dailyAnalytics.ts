/**
 * Daily Analytics Cron Job
 * 
 * Runs daily at 2 AM UTC to collect engagement statistics from Twitter API.
 * Stores data in SQLite for dashboard analytics without hitting API limits.
 */

import cron from 'node-cron';
import logger from '$lib/server/logger';
import { collectAllAccountsStats } from '$lib/server/services/analyticsCollector';
import { generateAllInsights } from '$lib/server/services/insightGenerator';
import { getDbInstance } from '$lib/server/db';

// Track cron job status
let isRunning = false;
let lastRunTime: Date | null = null;
let lastRunStatus: 'success' | 'failed' | 'partial' = 'success';
let lastRunResults: {
	success: number;
	failed: number;
	errors: string[];
} | null = null;

/**
 * Main cron job function - collects daily stats for all accounts
 */
async function runDailyAnalyticsCollection(): Promise<void> {
	if (isRunning) {
		logger.warn('Daily analytics collection already running, skipping...');
		return;
	}

	isRunning = true;
	const startTime = Date.now();
	logger.info('Starting daily analytics collection...');

	try {
		// Collect stats for all accounts
		const results = await collectAllAccountsStats();
		
		// Generate insights for all users
		const db = getDbInstance();
		const users = (db as any)['db'].query('SELECT DISTINCT id FROM users');
		
		for (const user of users) {
			try {
				await generateAllInsights(user.id);
			} catch (error) {
				logger.error({ error, userId: user.id }, 'Failed to generate insights for user');
			}
		}
		
		lastRunResults = results;
		lastRunTime = new Date();

		// Determine status
		if (results.failed === 0) {
			lastRunStatus = 'success';
			logger.info(
				{ 
					duration: Date.now() - startTime,
					success: results.success,
					failed: results.failed
				},
				'Daily analytics collection completed successfully'
			);
		} else if (results.success > 0) {
			lastRunStatus = 'partial';
			logger.warn(
				{
					duration: Date.now() - startTime,
					success: results.success,
					failed: results.failed,
					errors: results.errors
				},
				'Daily analytics collection completed with some failures'
			);
		} else {
			lastRunStatus = 'failed';
			logger.error(
				{
					duration: Date.now() - startTime,
					failed: results.failed,
					errors: results.errors
				},
				'Daily analytics collection failed for all accounts'
			);
		}
	} catch (error) {
		lastRunStatus = 'failed';
		lastRunTime = new Date();
		logger.error(
			{
				error,
				duration: Date.now() - startTime,
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			'Daily analytics collection failed with exception'
		);
	} finally {
		isRunning = false;
	}
}

/**
 * Initialize the cron job
 * 
 * Schedule: Daily at 2:00 AM UTC
 * Cron expression: '0 2 * * *'
 * 
 * @returns Cron job instance
 */
export function initializeDailyAnalyticsCron() {
	// Schedule: Every day at 2:00 AM UTC
	const cronExpression = '0 2 * * *';
	
	const job = cron.schedule(cronExpression, async () => {
		await runDailyAnalyticsCollection();
	}, {
		timezone: 'UTC'
	} as any); // node-cron types are incomplete

	logger.info(
		{ schedule: cronExpression, timezone: 'UTC' },
		'Daily analytics cron job initialized'
	);

	return job;
}

/**
 * Manually trigger the analytics collection
 * 
 * Useful for testing or immediate data refresh.
 * 
 * @returns Promise with collection results
 */
export async function triggerManualCollection(): Promise<{
	success: boolean;
	message: string;
	results?: {
		success: number;
		failed: number;
		errors: string[];
	};
}> {
	if (isRunning) {
		return {
			success: false,
			message: 'Analytics collection is already running'
		};
	}

	try {
		await runDailyAnalyticsCollection();
		
		return {
			success: true,
			message: 'Analytics collection completed',
			results: lastRunResults || undefined
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Collection failed'
		};
	}
}

/**
 * Get the status of the cron job
 * 
 * @returns Current status information
 */
export function getCronStatus() {
	return {
		isRunning,
		lastRunTime,
		lastRunStatus,
		lastRunResults,
		nextRunTime: getNextRunTime()
	};
}

/**
 * Calculate next run time (2 AM UTC tomorrow)
 */
function getNextRunTime(): Date {
	const now = new Date();
	const next = new Date(now);
	next.setUTCHours(2, 0, 0, 0);
	
	// If 2 AM today has passed, schedule for tomorrow
	if (next <= now) {
		next.setUTCDate(next.getUTCDate() + 1);
	}
	
	return next;
}

// Auto-initialize on import (for production)
// Can be disabled in tests by checking NODE_ENV
if (process.env.NODE_ENV !== 'test') {
	initializeDailyAnalyticsCron();
	logger.info('Daily analytics cron job auto-started');
}
