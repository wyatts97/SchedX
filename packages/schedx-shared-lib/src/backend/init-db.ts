import { DatabaseClient } from './db-sqlite.js';
import { runMigrations, seedDefaultAdmin } from './migrations/runner.js';
import bcrypt from 'bcrypt';

/**
 * Initialize SQLite database with schema and default admin user
 */
export async function initializeDatabase(
  dbPath: string,
  encryptionKey: string,
  authSecret: string,
  adminEmail: string = 'admin@schedx.local',
  adminPassword: string = 'admin123'
): Promise<DatabaseClient> {
  // Get database instance
  const db = DatabaseClient.getInstance(dbPath, encryptionKey, authSecret);
  
  // Run migrations to create tables
  await runMigrations(db['db']); // Access private db property
  
  // Hash admin password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  
  // Seed default admin user
  await seedDefaultAdmin(db['db'], adminEmail, hashedPassword);
  
  return db;
}
