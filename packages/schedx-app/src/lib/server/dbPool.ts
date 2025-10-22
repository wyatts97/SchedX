import logger from '$lib/server/logger';

/**
 * Database Pool - Stub for SQLite compatibility
 * Note: This file was designed for MongoDB. SchedX uses SQLite, so this is a compatibility stub.
 * SQLite connections are managed by the DatabaseClient in @schedx/shared-lib.
 */

interface ConnectionPoolConfig {
	maxPoolSize: number;
	minPoolSize: number;
	maxIdleTimeMS: number;
	waitQueueTimeoutMS: number;
}

class DatabasePool {
	private static instance: DatabasePool;
	private isConnected = false;
	private config: ConnectionPoolConfig;

	private constructor() {
		this.config = {
			maxPoolSize: 10,
			minPoolSize: 2,
			maxIdleTimeMS: 30000,
			waitQueueTimeoutMS: 5000
		};
		this.isConnected = true; // SQLite is always "connected"
	}

	public static getInstance(): DatabasePool {
		if (!DatabasePool.instance) {
			DatabasePool.instance = new DatabasePool();
		}
		return DatabasePool.instance;
	}

	public async connect(): Promise<void> {
		// SQLite connection is managed by DatabaseClient
		logger.debug('SQLite connection managed by DatabaseClient');
	}

	public async getDatabase(_dbName: string = 'schedx') {
		// For SQLite, return a stub - actual DB access is through DatabaseClient
		throw new Error('Use getDbInstance() from db.ts for SQLite database access');
	}

	public async close(): Promise<void> {
		logger.info('SQLite connection close handled by DatabaseClient');
	}

	public isHealthy(): boolean {
		return this.isConnected;
	}

	public async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
		return { healthy: true, latency: 0 };
	}

	public getConnectionStats() {
		return {
			isConnected: this.isConnected,
			hasClient: true,
			config: this.config,
			message: 'SQLite connection managed by DatabaseClient'
		};
	}
}

// Export singleton instance
export const dbPool = DatabasePool.getInstance();

// Graceful shutdown handler
if (typeof process !== 'undefined') {
	process.on('SIGINT', async () => {
		logger.info('Received SIGINT');
		await dbPool.close();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		logger.info('Received SIGTERM');
		await dbPool.close();
		process.exit(0);
	});
}
