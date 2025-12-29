import { DatabaseClient } from './db-sqlite.js';
import { runMigrations, seedDefaultAdmin } from './migrations/runner.js';
import { hash } from '@node-rs/argon2';

/**
 * Initialize SQLite database with schema and default admin user
 */
export async function initializeDatabase(
  dbPath: string,
  encryptionKey: string,
  authSecret: string,
  adminEmail: string = 'admin@schedx.local',
  adminPassword: string = 'changeme'
): Promise<DatabaseClient> {
  // Get database instance
  const db = DatabaseClient.getInstance(dbPath, encryptionKey, authSecret);
  
  // Run migrations to create tables
  await runMigrations(db['db']); // Access private db property
  
  // Hash admin password with argon2
  const hashedPassword = await hash(adminPassword);
  
  // Seed default admin user
  await seedDefaultAdmin(db['db'], adminEmail, hashedPassword);
  
  return db;
}
