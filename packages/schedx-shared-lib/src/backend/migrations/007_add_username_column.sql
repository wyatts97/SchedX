-- Migration 007: Add username column to users table
-- Allows users to have a unique username for login

ALTER TABLE users ADD COLUMN username TEXT UNIQUE;

-- Set default username to 'admin' for existing users with role='admin'
UPDATE users SET username = 'admin' WHERE role = 'admin' AND username IS NULL;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
