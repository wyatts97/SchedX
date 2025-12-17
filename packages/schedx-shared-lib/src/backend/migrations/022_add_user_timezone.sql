-- Migration 022: Add timezone column to users table
-- Stores user's preferred timezone for scheduling and display

ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC';

-- Create index for timezone lookups
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);
