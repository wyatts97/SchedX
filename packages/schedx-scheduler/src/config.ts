import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug: Check if critical environment variables are loaded
console.log('AUTH_SECRET loaded:', !!process.env.AUTH_SECRET);
console.log('AUTH_SECRET value:', process.env.AUTH_SECRET ? '***SET***' : 'NOT SET');
console.log('DB_ENCRYPTION_KEY loaded:', !!process.env.DB_ENCRYPTION_KEY);
console.log('DB_ENCRYPTION_KEY value:', process.env.DB_ENCRYPTION_KEY ? '***SET***' : 'NOT SET');
console.log('Environment:', process.env.NODE_ENV || 'development');

// Resolve database path - if relative, make it relative to project root
let dbPath = process.env.DATABASE_PATH || './data/schedx.db';
if (!dbPath.startsWith('/') && !dbPath.match(/^[A-Z]:\\/i)) {
  // Relative path - resolve from project root (3 levels up from src/)
  dbPath = resolve(__dirname, '../../../', dbPath);
}

// Ensure the directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
  console.log('Created database directory:', dbDir);
}

export const DATABASE_PATH = dbPath;
export const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || '';
export const AUTH_SECRET = process.env.AUTH_SECRET || '';
export const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '* * * * *';
export const PORT = process.env.PORT || '5173';
export const ORIGIN = process.env.ORIGIN || `http://localhost:${PORT}`;

// Email notification configuration
export const EMAIL_NOTIFICATIONS_ENABLED = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
export const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend';
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@schedx.app';
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'SchedX';

// Note: Twitter API credentials are now managed through the database
// and will be retrieved dynamically for each account