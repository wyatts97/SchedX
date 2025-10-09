import { log } from './logger';
import { resolve, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';

export interface EnvironmentConfig {
	// Authentication
	AUTH_SECRET: string;

	// Database
	DATABASE_PATH: string;
	DB_ENCRYPTION_KEY: string;

	// Server
	HOST: string;
	ORIGIN: string;
	PORT: number;
	NODE_ENV: 'development' | 'production' | 'test';

	// File uploads
	MAX_UPLOAD_SIZE: number;
}

/**
 * Resolve and prepare database path
 */
function prepareDatabasePath(dbPath: string): string {
	// If relative path, resolve from project root
	let resolvedPath = dbPath;
	if (!dbPath.startsWith('/') && !dbPath.match(/^[A-Z]:\\/i)) {
		// Relative path - resolve from project root
		// We're in packages/schedx-app/src/lib/server, so go up 5 levels
		resolvedPath = resolve(process.cwd(), dbPath);
	}

	// Ensure the directory exists
	const dbDir = dirname(resolvedPath);
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
		log.info('Created database directory', { path: dbDir });
	}

	return resolvedPath;
}

/**
 * Validate and load environment configuration
 */
export function validateEnvironment(): EnvironmentConfig {
	const config: EnvironmentConfig = {
		// Authentication
		AUTH_SECRET: getRequiredEnv('AUTH_SECRET'),

		// Database
		DATABASE_PATH: prepareDatabasePath(getRequiredEnv('DATABASE_PATH')),
		DB_ENCRYPTION_KEY: getRequiredEnv('DB_ENCRYPTION_KEY'),

		// Server
		HOST: process.env.HOST || '0.0.0.0',
		ORIGIN: process.env.ORIGIN || 'http://localhost:5173',
		PORT: parseInt(process.env.PORT || '5173', 10),
		NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',

		// File uploads
		MAX_UPLOAD_SIZE: parseInt(process.env.MAX_UPLOAD_SIZE || '52428800', 10) // 50MB default
	};

	// Validate required fields
	validateRequiredFields(config);

	// Validate format of specific fields
	validateFieldFormats(config);

	// Log configuration status
	logConfigurationStatus(config);

	return config;
}

/**
 * Get required environment variable
 */
function getRequiredEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

/**
 * Validate required fields
 */
function validateRequiredFields(config: EnvironmentConfig): void {
	const requiredFields = ['AUTH_SECRET', 'DATABASE_PATH', 'DB_ENCRYPTION_KEY'];

	for (const field of requiredFields) {
		if (!config[field as keyof EnvironmentConfig]) {
			throw new Error(`Missing required environment variable: ${field}`);
		}
	}
}

/**
 * Validate field formats
 */
function validateFieldFormats(config: EnvironmentConfig): void {
	// Validate AUTH_SECRET length
	if (config.AUTH_SECRET.length < 32) {
		throw new Error('AUTH_SECRET must be at least 32 characters long');
	}

	// Validate DB_ENCRYPTION_KEY length
	if (config.DB_ENCRYPTION_KEY.length < 32) {
		throw new Error('DB_ENCRYPTION_KEY must be at least 32 characters long');
	}

	// Validate PORT range
	if (config.PORT < 1 || config.PORT > 65535) {
		throw new Error('PORT must be between 1 and 65535');
	}

	// Validate MAX_UPLOAD_SIZE
	if (config.MAX_UPLOAD_SIZE < 1024 || config.MAX_UPLOAD_SIZE > 100 * 1024 * 1024) {
		throw new Error('MAX_UPLOAD_SIZE must be between 1KB and 100MB');
	}

	// Validate ORIGIN URL format
	try {
		new URL(config.ORIGIN);
	} catch {
		throw new Error('ORIGIN must be a valid URL');
	}

	// Validate DATABASE_PATH format
	if (!config.DATABASE_PATH || config.DATABASE_PATH.trim() === '') {
		throw new Error('DATABASE_PATH must be a valid file path');
	}
}

/**
 * Log configuration status
 */
function logConfigurationStatus(config: EnvironmentConfig): void {
	log.info('Environment configuration loaded', {
		nodeEnv: config.NODE_ENV,
		port: config.PORT,
		origin: config.ORIGIN,
		maxUploadSize: `${Math.round(config.MAX_UPLOAD_SIZE / 1024 / 1024)}MB`
	});

	log.info('Twitter API configuration will be managed through the admin interface');
}

/**
 * Get environment configuration singleton
 */
let envConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
	if (!envConfig) {
		envConfig = validateEnvironment();
	}
	return envConfig;
}
