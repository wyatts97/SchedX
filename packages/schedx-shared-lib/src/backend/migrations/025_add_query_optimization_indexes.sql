-- Add indexes for common query patterns to improve performance
-- These indexes optimize the most frequently executed queries

-- Index for finding due tweets (used by scheduler every minute)
CREATE INDEX IF NOT EXISTS idx_tweets_scheduled_status_date 
ON tweets(status, scheduledDate) 
WHERE status = 'SCHEDULED' AND scheduledDate IS NOT NULL;

-- Index for finding posted tweets with Twitter IDs (used by engagement sync)
CREATE INDEX IF NOT EXISTS idx_tweets_posted_with_twitter_id 
ON tweets(status, twitterTweetId) 
WHERE status = 'POSTED' AND twitterTweetId IS NOT NULL;

-- Index for user's tweets by status (used in dashboard queries)
CREATE INDEX IF NOT EXISTS idx_tweets_user_status 
ON tweets(userId, status, scheduledDate DESC);

-- Index for account lookups by provider
CREATE INDEX IF NOT EXISTS idx_accounts_provider_user 
ON accounts(provider, userId);

-- Index for session lookups (used on every authenticated request)
CREATE INDEX IF NOT EXISTS idx_sessions_expiry 
ON sessions(expiresAt) 
WHERE expiresAt > 0;

-- Index for thread lookups
CREATE INDEX IF NOT EXISTS idx_threads_user_status 
ON threads(userId, status, scheduledDate DESC);

-- Index for retry tweets (used by scheduler)
CREATE INDEX IF NOT EXISTS idx_tweets_retry 
ON tweets(status, nextRetryAt, retryCount) 
WHERE status = 'SCHEDULED' AND nextRetryAt IS NOT NULL;
