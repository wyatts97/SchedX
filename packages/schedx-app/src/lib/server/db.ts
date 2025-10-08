import { getEnvironmentConfig } from '$lib/server/env';
import { DatabaseClient } from '@schedx/shared-lib/backend';
import logger from '$lib/logger';
import { createDatabaseIndexes } from './db-indexes';

// Create a lazy-loaded singleton pattern
let dbInstance: DatabaseClient | null = null;

export function getDbInstance(): DatabaseClient {
	if (!dbInstance) {
		try {
			const config = getEnvironmentConfig();
			dbInstance = DatabaseClient.getInstance(config.MONGODB_URI, config.DB_ENCRYPTION_KEY);
		} catch (error) {
			logger.error('Database client initialization failed', { error });
			throw error;
		}
	}
	return dbInstance;
}

export const initializeDatabase = async (): Promise<DatabaseClient> => {
	const db = getDbInstance();
	await db.connect();

	// Create database indexes for optimal performance
	try {
		await createDatabaseIndexes();
	} catch (error) {
		logger.error('Failed to create database indexes during initialization', { error });
		// Don't throw - indexes can be created later
	}

	return db;
};

// Ensure a default admin user exists
export async function ensureDefaultAdminUser() {
	const db = getDbInstance();
	const existing = await db.getAdminUserByUsername('admin');
	if (!existing) {
		const bcrypt = (await import('bcrypt')).default;
		const passwordHash = await bcrypt.hash('changeme', 10);
		await db.createAdminUser({
			username: 'admin',
			passwordHash,
			createdAt: new Date()
		});
		// Log admin user creation
		logger.warn('Default admin user created with default password - CHANGE IMMEDIATELY', {
			username: 'admin',
			requiresPasswordChange: true
		});
	}
}
