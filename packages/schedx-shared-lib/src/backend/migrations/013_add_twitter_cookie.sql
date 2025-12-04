-- Migration 013: Add twitter_cookie column to users table
-- This column stores encrypted Rettiwt API keys for optional enhanced access
-- NOTE: This column was renamed to rettiwt_api_key in migration 014

ALTER TABLE users ADD COLUMN twitter_cookie TEXT NULL;

-- Add index for quick lookup of users with API keys configured
CREATE INDEX IF NOT EXISTS idx_users_twitter_cookie ON users(twitter_cookie) WHERE twitter_cookie IS NOT NULL;
