import { getDbInstance } from './db';
import logger from './logger';

/**
 * Database indexes for optimal performance
 */
export async function createDatabaseIndexes() {
	try {
		const db = getDbInstance();
		const database = await db.connect();

		logger.info('Creating database indexes...');

		// Tweets collection indexes
		const tweetsCollection = database.collection('tweets');

		// Index for finding tweets by user and status
		await tweetsCollection.createIndex(
			{ userId: 1, status: 1, scheduledDate: 1 },
			{ name: 'user_status_scheduled_idx' }
		);

		// Index for finding due tweets (scheduler)
		await tweetsCollection.createIndex(
			{ status: 1, scheduledDate: 1 },
			{ name: 'status_scheduled_idx' }
		);

		// Index for finding tweets by user and account
		await tweetsCollection.createIndex(
			{ userId: 1, twitterAccountId: 1, status: 1 },
			{ name: 'user_account_status_idx' }
		);

		// Index for finding tweets by Twitter ID (for analytics)
		await tweetsCollection.createIndex(
			{ twitterTweetId: 1 },
			{ name: 'twitter_tweet_id_idx', sparse: true }
		);

		// Index for finding templates
		await tweetsCollection.createIndex(
			{ userId: 1, templateName: 1 },
			{ name: 'user_template_idx', sparse: true }
		);

		// Index for finding drafts
		await tweetsCollection.createIndex(
			{ userId: 1, status: 1, twitterAccountId: 1 },
			{ name: 'user_status_account_idx' }
		);

		// Index for cleanup operations
		await tweetsCollection.createIndex({ createdAt: 1 }, { name: 'created_at_idx' });

		// Accounts collection indexes
		const accountsCollection = database.collection('accounts');

		// Index for finding accounts by user
		await accountsCollection.createIndex({ userId: 1, provider: 1 }, { name: 'user_provider_idx' });

		// Index for finding accounts by provider account ID
		await accountsCollection.createIndex(
			{ providerAccountId: 1 },
			{ name: 'provider_account_id_idx', unique: true }
		);

		// Index for finding accounts by Twitter app
		await accountsCollection.createIndex({ twitterAppId: 1 }, { name: 'twitter_app_id_idx' });

		// Index for finding default accounts
		await accountsCollection.createIndex(
			{ isDefault: 1 },
			{ name: 'is_default_idx', sparse: true }
		);

		// Twitter Apps collection indexes
		const twitterAppsCollection = database.collection('twitter_apps');

		// Index for finding apps by name
		await twitterAppsCollection.createIndex({ name: 1 }, { name: 'name_idx' });

		// Index for finding apps by client ID
		await twitterAppsCollection.createIndex({ clientId: 1 }, { name: 'client_id_idx' });

		// Users collection indexes
		const usersCollection = database.collection('users');

		// Index for finding users by username
		await usersCollection.createIndex({ username: 1 }, { name: 'username_idx', unique: true });

		// Sessions collection indexes
		const sessionsCollection = database.collection('sessions');

		// Index for finding sessions by session ID
		await sessionsCollection.createIndex(
			{ sessionId: 1 },
			{ name: 'session_id_idx', unique: true }
		);

		// Index for cleanup of expired sessions
		await sessionsCollection.createIndex({ expiresAt: 1 }, { name: 'expires_at_idx' });

		// Notifications collection indexes
		const notificationsCollection = database.collection('notifications');

		// Index for finding notifications by user
		await notificationsCollection.createIndex(
			{ userId: 1, status: 1, createdAt: -1 },
			{ name: 'user_status_created_idx' }
		);

		// Index for finding notifications by tweet
		await notificationsCollection.createIndex(
			{ tweetId: 1 },
			{ name: 'tweet_id_idx', sparse: true }
		);

		// Index for cleanup of old notifications
		await notificationsCollection.createIndex(
			{ createdAt: 1 },
			{ name: 'notifications_created_at_idx' }
		);

		// API Usage collection indexes
		const apiUsageCollection = database.collection('api_usage');

		// Index for finding API usage by user and month
		await apiUsageCollection.createIndex(
			{ userId: 1, month: 1 },
			{ name: 'user_month_idx', unique: true }
		);

		// Index for cleanup of old usage data
		await apiUsageCollection.createIndex({ createdAt: 1 }, { name: 'api_usage_created_at_idx' });

		logger.info('Database indexes created successfully');

		// Log index information
		const collections = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];
		for (const collectionName of collections) {
			const collection = database.collection(collectionName);
			const indexes = await collection.indexes();
			logger.debug(`Indexes for ${collectionName}: ${indexes.length} indexes`);
		}
	} catch (error) {
		logger.error('Failed to create database indexes');
		throw error;
	}
}

/**
 * Drop all indexes (for development/testing)
 */
export async function dropAllIndexes() {
	try {
		const db = getDbInstance();
		const database = await db.connect();

		logger.warn('Dropping all database indexes...');

		const collections = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];

		for (const collectionName of collections) {
			const collection = database.collection(collectionName);
			await collection.dropIndexes();
			logger.info(`Dropped indexes for ${collectionName}`);
		}

		logger.warn('All database indexes dropped');
	} catch (error) {
		logger.error('Failed to drop database indexes');
		throw error;
	}
}

/**
 * Get index statistics
 */
export async function getIndexStats() {
	try {
		const db = getDbInstance();
		const database = await db.connect();

		const stats: Record<string, any> = {};

		const collections = [
			'tweets',
			'accounts',
			'twitter_apps',
			'users',
			'sessions',
			'notifications',
			'api_usage'
		];

		for (const collectionName of collections) {
			const collection = database.collection(collectionName);
			const indexes = await collection.indexes();

			stats[collectionName] = {
				indexCount: indexes.length,
				indexes: indexes.map((idx) => ({
					name: idx.name,
					key: idx.key,
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
		logger.error('Failed to get index stats');
		throw error;
	}
}
