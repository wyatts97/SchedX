-- SchedX SQLite Schema
-- Migration 002: Analytics and Insights Tables
-- Purpose: Support enhanced dashboard overview with engagement tracking and smart insights

-- Daily engagement snapshots per account
-- Stores aggregated daily metrics to avoid repeated Twitter API calls
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format for easy querying
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_retweets INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0, -- Calculated: (likes + replies + retweets) / followers * 100
  top_tweet_id TEXT, -- Tweet with highest engagement for this day
  posts_count INTEGER DEFAULT 0, -- Number of tweets posted this day
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_stats_account_date ON daily_stats(account_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);

-- Content analytics per tweet
-- Analyzes tweet composition for insights and content mix visualization
CREATE TABLE IF NOT EXISTS content_analytics (
  id TEXT PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  has_image INTEGER DEFAULT 0, -- Boolean: contains image attachment
  has_video INTEGER DEFAULT 0, -- Boolean: contains video attachment
  has_gif INTEGER DEFAULT 0, -- Boolean: contains GIF attachment
  has_link INTEGER DEFAULT 0, -- Boolean: contains URL
  media_count INTEGER DEFAULT 0, -- Total number of media attachments
  hashtag_count INTEGER DEFAULT 0, -- Number of hashtags in tweet
  hashtags TEXT, -- JSON array: ["tag1", "tag2"] for frequency analysis
  mention_count INTEGER DEFAULT 0, -- Number of @mentions
  char_count INTEGER DEFAULT 0, -- Character count (for length analysis)
  post_hour INTEGER, -- 0-23, hour of day posted (user's timezone)
  post_day INTEGER, -- 0-6, day of week (Sunday=0)
  post_timestamp INTEGER NOT NULL, -- Unix timestamp for sorting
  engagement_score REAL DEFAULT 0, -- Sum: likes + replies + retweets
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE,
  UNIQUE(tweet_id)
);
CREATE INDEX IF NOT EXISTS idx_content_analytics_tweet ON content_analytics(tweet_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_post_time ON content_analytics(post_hour, post_day);
CREATE INDEX IF NOT EXISTS idx_content_analytics_engagement ON content_analytics(engagement_score DESC);

-- Smart insights cache
-- Stores generated insights to avoid recomputation
CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL, -- 'best_time', 'content_type', 'inactive_account', 'top_hashtag', 'engagement_drop'
  title TEXT NOT NULL, -- Short headline (e.g., "Best Posting Time")
  message TEXT NOT NULL, -- Full insight text (e.g., "Your best posting day is Tuesday at 8 PM")
  priority INTEGER DEFAULT 0, -- 0=low, 1=medium, 2=high (for sorting)
  data TEXT, -- JSON metadata for rendering (e.g., {"hour": 20, "day": 2, "avg_engagement": 45})
  generated_at INTEGER NOT NULL, -- When insight was created
  expires_at INTEGER NOT NULL, -- When insight should be regenerated
  dismissed INTEGER DEFAULT 0, -- User dismissed this insight
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_insights_user_expires ON insights(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON insights(priority DESC, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_dismissed ON insights(dismissed, expires_at);

-- Tweet engagement history
-- Tracks how engagement metrics change over time (for trend analysis)
CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id TEXT PRIMARY KEY,
  tweet_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL, -- YYYY-MM-DD
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tweet_id) REFERENCES tweets(id) ON DELETE CASCADE,
  UNIQUE(tweet_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_tweet_date ON engagement_snapshots(tweet_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_engagement_snapshots_date ON engagement_snapshots(snapshot_date);
