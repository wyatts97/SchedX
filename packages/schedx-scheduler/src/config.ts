import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (3 levels up from packages/schedx-scheduler/src)
const envPath = path.resolve(__dirname, '../../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Debug: Check if AUTH_SECRET is loaded
console.log('AUTH_SECRET loaded:', !!process.env.AUTH_SECRET);
console.log('AUTH_SECRET value:', process.env.AUTH_SECRET ? '***SET***' : 'NOT SET');

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
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