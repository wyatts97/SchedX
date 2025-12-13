-- Add retry support columns to tweets table
-- These columns enable automatic retry of failed tweets with exponential backoff

ALTER TABLE tweets ADD COLUMN retryCount INTEGER DEFAULT 0;
ALTER TABLE tweets ADD COLUMN maxRetries INTEGER DEFAULT 3;
ALTER TABLE tweets ADD COLUMN lastError TEXT;
ALTER TABLE tweets ADD COLUMN nextRetryAt INTEGER;

-- Create index for efficient retry query
CREATE INDEX IF NOT EXISTS idx_tweets_retry ON tweets(status, nextRetryAt) WHERE status = 'failed' AND nextRetryAt IS NOT NULL;
