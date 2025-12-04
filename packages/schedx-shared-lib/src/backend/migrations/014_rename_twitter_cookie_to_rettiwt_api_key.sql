-- Migration 014: Rename twitter_cookie to rettiwt_api_key for clarity
-- This clarifies that the column stores Rettiwt API Keys (base64-encoded cookies), not raw cookies

-- Rename the column
ALTER TABLE users RENAME COLUMN twitter_cookie TO rettiwt_api_key;

-- Drop old index
DROP INDEX IF EXISTS idx_users_twitter_cookie;

-- Create new index for quick lookup of users with Rettiwt API keys configured
CREATE INDEX IF NOT EXISTS idx_users_rettiwt_api_key ON users(rettiwt_api_key) WHERE rettiwt_api_key IS NOT NULL;
