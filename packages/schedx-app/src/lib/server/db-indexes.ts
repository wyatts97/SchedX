import { getRawDbInstance } from './db';
import logger from './logger';
import { runMigrations } from '@schedx/shared-lib/backend';

/**
 * Database indexes for optimal performance
 */
export async function createDatabaseIndexes() {
	try {
		const db = getRawDbInstance();
		logger.info('Creating database indexes...');

		await db.exec(`
			CREATE INDEX IF NOT EXISTS user_status_scheduled_idx ON tweets(userId, status, scheduledDate);
			CREATE INDEX IF NOT EXISTS status_scheduled_idx ON tweets(status, scheduledDate);
			CREATE INDEX IF NOT EXISTS user_account_status_idx ON tweets(userId, twitterAccountId, status);
			CREATE INDEX IF NOT EXISTS user_template_idx ON tweets(userId, templateName);
			CREATE INDEX IF NOT EXISTS user_status_account_idx ON tweets(userId, status, twitterAccountId);
			CREATE INDEX IF NOT EXISTS created_at_idx ON tweets(createdAt);
			CREATE INDEX IF NOT EXISTS user_provider_idx ON accounts(userId, provider);
			CREATE INDEX IF NOT EXISTS provider_account_id_idx ON accounts(providerAccountId);
			CREATE INDEX IF NOT EXISTS twitter_app_id_idx ON accounts(twitterAppId);
			CREATE INDEX IF NOT EXISTS is_default_idx ON accounts(isDefault);
			CREATE INDEX IF NOT EXISTS name_idx ON twitter_apps(name);
			CREATE INDEX IF NOT EXISTS client_id_idx ON twitter_apps(clientId);
			CREATE INDEX IF NOT EXISTS username_idx ON users(username);
			CREATE INDEX IF NOT EXISTS session_id_idx ON sessions(sessionId);
			CREATE INDEX IF NOT EXISTS expires_at_idx ON sessions(expiresAt);
			CREATE INDEX IF NOT EXISTS user_status_created_idx ON notifications(userId, status, createdAt);
			CREATE INDEX IF NOT EXISTS tweet_id_idx ON notifications(tweetId);
			CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(createdAt);
			CREATE INDEX IF NOT EXISTS user_month_idx ON api_usage(userId, month);
			CREATE INDEX IF NOT EXISTS api_usage_created_at_idx ON api_usage(createdAt);
		`);

		logger.info('Database indexes created successfully');

		// Log index information
		const tables = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];
		for (const tableName of tables) {
			const indexes = await db.all(`PRAGMA index_list(${tableName})`);
			logger.debug(`Indexes for ${tableName}: ${indexes.length} indexes`);
		}
	} catch (error) {
		logger.error(`Failed to create database indexes: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}

/**
 * Drop all indexes (for development/testing)
 */
export async function dropAllIndexes() {
	try {
		const db = getRawDbInstance();
		logger.warn('Dropping all database indexes...');

		const tables = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];

		for (const tableName of tables) {
			const indexes = await db.all(`PRAGMA index_list(${tableName})`);
			for (const idx of indexes as Array<{name: string}>) {
				await db.exec(`DROP INDEX ${idx.name}`);
			}
			logger.info(`Dropped indexes for ${tableName}`);
		}

		logger.warn('All database indexes dropped');
	} catch (error) {
		logger.error(`Failed to drop database indexes: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
	try {
		const db = getRawDbInstance();
		const stats: Record<string, any> = {};

		const tables = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];

		for (const tableName of tables) {
			const indexes = await db.all(`PRAGMA index_list(${tableName})`);
			const indexStats = await db.all(`PRAGMA index_info(${tableName})`);

			stats[tableName] = {
				indexCount: indexes.length,
				indexes: indexStats.map((idx: {name: string, unique?: boolean, sparse?: boolean}) => ({
					name: idx.name,
					key: idx.name,
					unique: idx.unique || false,
					sparse: idx.sparse || false
				})),
				documentCount: 0, // Will be populated if stats API is available
				size: 0,
				avgObjSize: 0
			};
		}

		return stats;
	} catch (error) {
		logger.error(`Failed to get index stats: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}
