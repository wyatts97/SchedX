-- Migration 007: Add username column to users table
-- Allows users to have a unique username for login

-- Add username column without UNIQUE constraint first
ALTER TABLE users ADD COLUMN username TEXT;

-- Set default username to 'admin' for existing users with role='admin'
UPDATE users SET username = 'admin' WHERE role = 'admin' AND username IS NULL;

-- Create unique index for username (this enforces uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
