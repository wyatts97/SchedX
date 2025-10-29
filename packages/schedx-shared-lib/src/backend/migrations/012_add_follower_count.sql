-- Migration 012: Add follower count to accounts table
-- Stores the current follower count fetched from Twitter API

ALTER TABLE accounts ADD COLUMN followersCount INTEGER DEFAULT 0;

-- Add updated_at to daily_stats if it doesn't exist
ALTER TABLE daily_stats ADD COLUMN updated_at INTEGER;
