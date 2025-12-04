-- Migration 017: Multi-Account Data Optimization
-- Purpose: Optimize data storage and retrieval for multiple Twitter accounts per user
-- Adds account-level tracking, follower history, data retention, and performance indexes

-- ============================================
-- 1. ACCOUNT-LEVEL RETTIWT API KEY
-- ============================================
-- Move Rettiwt API key from user level to account level
-- Allows different API keys for different Twitter accounts
ALTER TABLE accounts ADD COLUMN rettiwt_api_key TEXT;

-- ============================================
-- 2. FOLLOWER HISTORY TRACKING
-- ============================================
-- Track follower count changes over time per account
CREATE TABLE IF NOT EXISTS follower_history (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  follower_count INTEGER NOT NULL,
  following_count INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follower_history_account_date ON follower_history(account_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_follower_history_recorded_at ON follower_history(recorded_at DESC);

-- ============================================
-- 3. ACCOUNT-LEVEL SYNC STATUS
-- ============================================
-- Track sync status per account instead of globally
CREATE TABLE IF NOT EXISTS account_sync_status (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  last_sync_at INTEGER,
  last_sync_status TEXT, -- 'success', 'partial', 'failed'
  last_error TEXT,
  tweets_synced INTEGER DEFAULT 0,
  tweets_failed INTEGER DEFAULT 0,
  next_sync_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_account_sync_status_account ON account_sync_status(account_id);
CREATE INDEX IF NOT EXISTS idx_account_sync_status_next_sync ON account_sync_status(next_sync_at);

-- ============================================
-- 4. ENGAGEMENT SNAPSHOT OPTIMIZATION
-- ============================================
-- Add account_id to engagement_snapshots for better filtering
ALTER TABLE engagement_snapshots ADD COLUMN account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_account ON engagement_snapshots(account_id, snapshot_date DESC);

-- Add tweet_age_days to optimize retention queries
ALTER TABLE engagement_snapshots ADD COLUMN tweet_age_days INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_age ON engagement_snapshots(tweet_age_days);

-- ============================================
-- 5. DAILY STATS OPTIMIZATION
-- ============================================
-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_account ON daily_stats(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_range ON daily_stats(date DESC);

-- ============================================
-- 6. CONTENT ANALYTICS OPTIMIZATION
-- ============================================
-- Add account_id for per-account content analysis
ALTER TABLE content_analytics ADD COLUMN account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_content_analytics_account ON content_analytics(account_id, post_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_content_analytics_account_engagement ON content_analytics(account_id, engagement_score DESC);

-- ============================================
-- 7. TWEETS TABLE OPTIMIZATION
-- ============================================
-- Add composite indexes for multi-account queries
CREATE INDEX IF NOT EXISTS idx_tweets_account_status_date ON tweets(twitterAccountId, status, scheduledDate DESC);
CREATE INDEX IF NOT EXISTS idx_tweets_user_account_status ON tweets(userId, twitterAccountId, status);
CREATE INDEX IF NOT EXISTS idx_tweets_posted_with_twitter_id ON tweets(status, twitterTweetId) WHERE status = 'posted' AND twitterTweetId IS NOT NULL;

-- ============================================
-- 8. DATA RETENTION METADATA
-- ============================================
-- Track data retention policies per user
CREATE TABLE IF NOT EXISTS data_retention_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  -- Engagement snapshot retention
  snapshot_retention_days INTEGER DEFAULT 90, -- Keep snapshots for 90 days
  snapshot_active_tweet_days INTEGER DEFAULT 30, -- Only snapshot tweets < 30 days old
  -- Follower history retention
  follower_history_retention_days INTEGER DEFAULT 365, -- Keep 1 year of follower history
  -- Daily stats retention
  daily_stats_retention_days INTEGER DEFAULT 180, -- Keep 6 months of daily stats
  -- Content analytics retention
  content_analytics_retention_days INTEGER DEFAULT 180,
  -- Auto-cleanup enabled
  auto_cleanup_enabled INTEGER DEFAULT 1,
  last_cleanup_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_data_retention_user ON data_retention_settings(user_id);

-- ============================================
-- 9. ACCOUNT METADATA
-- ============================================
-- Add metadata columns to accounts table
ALTER TABLE accounts ADD COLUMN last_tweet_sync_at INTEGER;
ALTER TABLE accounts ADD COLUMN last_follower_sync_at INTEGER;
ALTER TABLE accounts ADD COLUMN total_tweets_synced INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN sync_enabled INTEGER DEFAULT 1;

-- ============================================
-- 10. INSIGHTS OPTIMIZATION
-- ============================================
-- Add account_id to insights for account-specific insights
ALTER TABLE insights ADD COLUMN account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_insights_account ON insights(account_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_user_account ON insights(user_id, account_id, dismissed, expires_at);

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- This migration:
-- 1. Moves Rettiwt API keys to account level for per-account authentication
-- 2. Adds follower_history table to track follower growth over time
-- 3. Creates account_sync_status for granular sync tracking
-- 4. Optimizes engagement_snapshots with account_id and age tracking
-- 5. Adds composite indexes for efficient multi-account queries
-- 6. Implements data retention framework with configurable policies
-- 7. Enhances accounts table with sync metadata
-- 8. Enables account-specific insights

-- Data Migration Notes:
-- - Existing user-level rettiwt_api_key should be copied to all accounts for that user
-- - Existing engagement_snapshots need account_id populated from tweets table
-- - Existing content_analytics need account_id populated from tweets table
-- - Default retention settings will be created for existing users on first access
