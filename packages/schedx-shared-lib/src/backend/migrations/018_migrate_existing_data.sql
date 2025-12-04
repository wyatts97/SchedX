-- Migration 018: Migrate Existing Data to Multi-Account Structure
-- Purpose: Populate new columns and tables with data from existing records

-- ============================================
-- 1. MIGRATE RETTIWT API KEYS TO ACCOUNTS
-- ============================================
-- Copy user-level rettiwt_api_key to all their Twitter accounts
UPDATE accounts
SET rettiwt_api_key = (
  SELECT rettiwt_api_key 
  FROM users 
  WHERE users.id = accounts.userId
)
WHERE provider = 'twitter' 
  AND rettiwt_api_key IS NULL
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = accounts.userId 
      AND users.rettiwt_api_key IS NOT NULL
  );

-- ============================================
-- 2. POPULATE ACCOUNT_ID IN ENGAGEMENT_SNAPSHOTS
-- ============================================
-- Link engagement snapshots to accounts via tweets
UPDATE engagement_snapshots
SET account_id = (
  SELECT twitterAccountId 
  FROM tweets 
  WHERE tweets.id = engagement_snapshots.tweet_id
)
WHERE account_id IS NULL;

-- ============================================
-- 3. POPULATE ACCOUNT_ID IN CONTENT_ANALYTICS
-- ============================================
-- Link content analytics to accounts via tweets
UPDATE content_analytics
SET account_id = (
  SELECT twitterAccountId 
  FROM tweets 
  WHERE tweets.id = content_analytics.tweet_id
)
WHERE account_id IS NULL;

-- ============================================
-- 4. POPULATE ACCOUNT_ID IN INSIGHTS
-- ============================================
-- For insights that reference specific tweets, link to account
UPDATE insights
SET account_id = (
  SELECT DISTINCT t.twitterAccountId
  FROM tweets t
  WHERE json_extract(insights.data, '$.tweetId') = t.id
  LIMIT 1
)
WHERE account_id IS NULL
  AND data IS NOT NULL
  AND json_extract(data, '$.tweetId') IS NOT NULL;

-- ============================================
-- 5. CALCULATE TWEET AGE FOR ENGAGEMENT SNAPSHOTS
-- ============================================
-- Calculate how old the tweet was when snapshot was taken
UPDATE engagement_snapshots
SET tweet_age_days = (
  SELECT CAST((engagement_snapshots.created_at - tweets.createdAt) / 86400000 AS INTEGER)
  FROM tweets
  WHERE tweets.id = engagement_snapshots.tweet_id
)
WHERE tweet_age_days = 0;

-- ============================================
-- 6. INITIALIZE ACCOUNT SYNC STATUS
-- ============================================
-- Create sync status records for all Twitter accounts
INSERT OR IGNORE INTO account_sync_status (
  id,
  account_id,
  last_sync_at,
  last_sync_status,
  last_error,
  tweets_synced,
  tweets_failed,
  next_sync_at,
  created_at,
  updated_at
)
SELECT 
  hex(randomblob(16)),
  id,
  updatedAt,
  'success',
  NULL,
  0,
  0,
  NULL,
  createdAt,
  updatedAt
FROM accounts
WHERE provider = 'twitter';

-- ============================================
-- 7. INITIALIZE FOLLOWER HISTORY
-- ============================================
-- Create initial follower history entry for accounts with follower counts
INSERT OR IGNORE INTO follower_history (
  id,
  account_id,
  follower_count,
  following_count,
  recorded_at
)
SELECT 
  hex(randomblob(16)),
  id,
  COALESCE(followerCount, 0),
  0, -- following count not tracked yet
  updatedAt
FROM accounts
WHERE provider = 'twitter'
  AND followerCount IS NOT NULL
  AND followerCount > 0;

-- ============================================
-- 8. INITIALIZE DATA RETENTION SETTINGS
-- ============================================
-- Create default retention settings for all users
INSERT OR IGNORE INTO data_retention_settings (
  id,
  user_id,
  snapshot_retention_days,
  snapshot_active_tweet_days,
  follower_history_retention_days,
  daily_stats_retention_days,
  content_analytics_retention_days,
  auto_cleanup_enabled,
  last_cleanup_at,
  created_at,
  updated_at
)
SELECT 
  hex(randomblob(16)),
  id,
  90,  -- 90 days snapshot retention
  30,  -- Only snapshot tweets < 30 days old
  365, -- 1 year follower history
  180, -- 6 months daily stats
  180, -- 6 months content analytics
  1,   -- Auto-cleanup enabled
  NULL,
  createdAt,
  createdAt
FROM users;

-- ============================================
-- 9. UPDATE ACCOUNT METADATA
-- ============================================
-- Set initial sync timestamps based on last update
-- Note: twitterAccountId stores providerAccountId (Twitter's numeric ID), not the account UUID
UPDATE accounts
SET 
  last_tweet_sync_at = updatedAt,
  last_follower_sync_at = updatedAt,
  total_tweets_synced = (
    SELECT COUNT(*) 
    FROM tweets 
    WHERE tweets.twitterAccountId = accounts.providerAccountId 
      AND LOWER(tweets.status) = 'posted'
      AND tweets.twitterTweetId IS NOT NULL
  ),
  sync_enabled = 1
WHERE provider = 'twitter';

-- ============================================
-- MIGRATION VERIFICATION QUERIES
-- ============================================
-- Run these to verify migration success:
-- SELECT COUNT(*) FROM accounts WHERE provider = 'twitter' AND rettiwt_api_key IS NOT NULL;
-- SELECT COUNT(*) FROM engagement_snapshots WHERE account_id IS NULL;
-- SELECT COUNT(*) FROM content_analytics WHERE account_id IS NULL;
-- SELECT COUNT(*) FROM account_sync_status;
-- SELECT COUNT(*) FROM follower_history;
-- SELECT COUNT(*) FROM data_retention_settings;
