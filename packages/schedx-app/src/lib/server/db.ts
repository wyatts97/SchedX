import { getEnvironmentConfig } from '$lib/server/env';
import { DatabaseClient, runMigrations } from '@schedx/shared-lib/backend';
import logger from '$lib/logger';

// Create a lazy-loaded singleton pattern
let dbInstance: DatabaseClient | null = null;

export function getDbInstance(): DatabaseClient {
	if (!dbInstance) {
		try {
			const config = getEnvironmentConfig();
			dbInstance = DatabaseClient.getInstance(
				config.DATABASE_PATH,
				config.DB_ENCRYPTION_KEY,
				config.AUTH_SECRET
			);
		} catch (error) {
			logger.error('Database client initialization failed', { error });
			throw error;
		}
	}
	return dbInstance;
}

export function getRawDbInstance() {
	const db = getDbInstance();
	return (db as any).db;
}

export const initializeDatabase = async (): Promise<DatabaseClient> => {
	const db = getDbInstance();
	await db.connect();

	// Run migrations to create tables
	try {
		await runMigrations(db['db']); // Access private db property
		logger.info('Database migrations completed successfully');
	} catch (error) {
		logger.error('Database migrations failed', { error });
		throw error;
	}

	logger.info('Database initialized successfully');

	return db;
};

// Ensure a default admin user exists
export async function ensureDefaultAdminUser() {
	const db = getDbInstance();
	// Check if ANY admin user exists (not just username 'admin')
	const hasAdmins = await (db as any).hasAdminUsers();
	if (!hasAdmins) {
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
