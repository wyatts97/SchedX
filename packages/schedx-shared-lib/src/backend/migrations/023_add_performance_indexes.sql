-- Migration 023: Add Performance Indexes
-- Adds critical indexes for frequently queried columns to improve performance

-- Index for finding scheduled tweets (used by scheduler)
CREATE INDEX IF NOT EXISTS idx_tweets_status_scheduled 
ON tweets(userId, status, scheduledDate) 
WHERE status = 'SCHEDULED';

-- Index for posted tweets with Twitter IDs (used by engagement sync)
-- Partial index optimized for engagement sync queries
CREATE INDEX IF NOT EXISTS idx_tweets_posted_with_twitter_id 
ON tweets(userId, twitterTweetId) 
WHERE status = 'POSTED' AND twitterTweetId IS NOT NULL;

-- Index for Twitter tweet ID lookups (used by engagement sync)
CREATE INDEX IF NOT EXISTS idx_tweets_twitter_id 
ON tweets(twitterTweetId) 
WHERE twitterTweetId IS NOT NULL;

-- Index for account lookups by provider and user
CREATE INDEX IF NOT EXISTS idx_accounts_provider_user 
ON accounts(userId, provider);

-- Index for Rettiwt API key lookups
CREATE INDEX IF NOT EXISTS idx_accounts_rettiwt_key 
ON accounts(userId, rettiwt_api_key) 
WHERE rettiwt_api_key IS NOT NULL;

-- Index for default account lookups
CREATE INDEX IF NOT EXISTS idx_accounts_default 
ON accounts(userId, isDefault) 
WHERE isDefault = 1;

-- Index for notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_status 
ON notifications(userId, read, createdAt);

-- Index for tweet status queries
CREATE INDEX IF NOT EXISTS idx_tweets_user_status 
ON tweets(userId, status, createdAt);

-- Index for account provider lookups
CREATE INDEX IF NOT EXISTS idx_accounts_provider_id 
ON accounts(providerAccountId);
