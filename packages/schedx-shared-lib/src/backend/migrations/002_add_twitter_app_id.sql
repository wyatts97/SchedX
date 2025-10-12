-- Migration 002: Add twitterAppId to accounts table
-- This links accounts to the Twitter app they were authenticated with

ALTER TABLE accounts ADD COLUMN twitterAppId TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_twitterAppId ON accounts(twitterAppId);
