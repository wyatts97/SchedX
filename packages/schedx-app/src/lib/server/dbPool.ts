import { MongoClient } from 'mongodb';
import type { MongoClientOptions } from 'mongodb';
import { getEnvironmentConfig } from '$lib/server/env';
import type { ConnectionPoolConfig } from '$lib/types';
import logger from '$lib/server/logger';

class DatabasePool {
	private static instance: DatabasePool;
	private client: MongoClient | null = null;
	private isConnected = false;
	private connectionPromise: Promise<MongoClient> | null = null;
	private config: ConnectionPoolConfig;

	private constructor() {
		this.config = {
			maxPoolSize: 10,
			minPoolSize: 2,
			maxIdleTimeMS: 30000,
			waitQueueTimeoutMS: 5000
		};
	}

	public static getInstance(): DatabasePool {
		if (!DatabasePool.instance) {
			DatabasePool.instance = new DatabasePool();
		}
		return DatabasePool.instance;
	}

	private getClientOptions(): MongoClientOptions {
		return {
			maxPoolSize: this.config.maxPoolSize,
			minPoolSize: this.config.minPoolSize,
			maxIdleTimeMS: this.config.maxIdleTimeMS,
			waitQueueTimeoutMS: this.config.waitQueueTimeoutMS,
			serverSelectionTimeoutMS: 5000,
			socketTimeoutMS: 45000,
			family: 4, // Use IPv4, skip trying IPv6
			retryWrites: true,
			retryReads: true,
			compressors: ['zlib'],
			zlibCompressionLevel: 6,
			// Connection monitoring
			monitorCommands: process.env.NODE_ENV === 'development'
		};
	}

	public async connect(): Promise<MongoClient> {
		if (this.isConnected && this.client) {
			return this.client;
		}

		// If connection is in progress, wait for it
		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		this.connectionPromise = this.establishConnection();
		return this.connectionPromise;
	}

	private async establishConnection(): Promise<MongoClient> {
		try {
			const config = getEnvironmentConfig();
			const options = this.getClientOptions();

			logger.info('Establishing database connection');

			this.client = new MongoClient(config.DATABASE_PATH, options);

			// Add event listeners for monitoring
			this.client.on('connectionPoolCreated', () => {
				logger.info('Database connection pool created');
			});

			this.client.on('connectionPoolClosed', () => {
				logger.info('Database connection pool closed');
				this.isConnected = false;
			});

			this.client.on('connectionCreated', (event) => {
				logger.debug('Database connection created');
			});

			this.client.on('connectionClosed', (event) => {
				logger.debug('Database connection closed');
			});

			this.client.on('commandStarted', (event) => {
				if (process.env.NODE_ENV === 'development') {
					logger.debug('Database command started');
				}
			});

			this.client.on('commandFailed', (event) => {
				logger.error('Database command failed');
			});

			await this.client.connect();

			// Test the connection
			await this.client.db('admin').command({ ping: 1 });

			this.isConnected = true;
			this.connectionPromise = null;

			logger.info('Database connection established successfully');
			return this.client;
		} catch (error) {
			this.connectionPromise = null;
			this.isConnected = false;

			logger.error('Failed to establish database connection');

			throw new Error(
				`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	public async getDatabase(dbName: string = 'schedx') {
		const client = await this.connect();
		return client.db(dbName);
	}

	public async close(): Promise<void> {
		if (this.client && this.isConnected) {
			try {
				await this.client.close();
				this.isConnected = false;
				this.client = null;
				logger.info('Database connection closed');
			} catch (error) {
				logger.error('Error closing database connection');
			}
		}
	}

	public isHealthy(): boolean {
		return this.isConnected && this.client !== null;
	}

	public async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
		try {
			if (!this.isConnected || !this.client) {
				return { healthy: false, error: 'Not connected' };
			}

			const start = Date.now();
			await this.client.db('admin').command({ ping: 1 });
			const latency = Date.now() - start;

			return { healthy: true, latency };
		} catch (error) {
			return {
				healthy: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	public getConnectionStats() {
		if (!this.client) {
			return null;
		}

		// Note: MongoDB Node.js driver doesn't expose detailed pool stats
		// This is a placeholder for basic connection info
		return {
			isConnected: this.isConnected,
			hasClient: !!this.client,
			config: this.config
		};
	}
}

// Export singleton instance
export const dbPool = DatabasePool.getInstance();

// Graceful shutdown handler
if (typeof process !== 'undefined') {
	process.on('SIGINT', async () => {
		logger.info('Received SIGINT, closing database connection...');
		await dbPool.close();
		process.exit(0);
	});

	process.on('SIGTERM', async () => {
		logger.info('Received SIGTERM, closing database connection...');
		await dbPool.close();
		process.exit(0);
	});
}
