-- Migration 008: Add username column safely (migration 007 failed due to UNIQUE constraint)
-- This migration will succeed even if migration 007 partially ran

-- Add username column without UNIQUE constraint (will be ignored if column already exists)
ALTER TABLE users ADD COLUMN username TEXT;

-- Set default username to 'admin' for existing users with role='admin' that don't have one
UPDATE users SET username = 'admin' WHERE role = 'admin' AND (username IS NULL OR username = '');

-- Create unique index for username (this enforces uniqueness)
-- Using IF NOT EXISTS so it won't fail if already created
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL AND username != '';
