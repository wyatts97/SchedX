-- Migration 003: Add composite indexes for performance
-- These indexes optimize common query patterns

-- Tweets: userId + status (used in all tweet list queries)
CREATE INDEX IF NOT EXISTS idx_tweets_user_status ON tweets(userId, status);

-- Tweets: status + scheduledDate (used by schedulers)
CREATE INDEX IF NOT EXISTS idx_tweets_status_scheduled ON tweets(status, scheduledDate);

-- Accounts: userId + provider (used when fetching user accounts)
CREATE INDEX IF NOT EXISTS idx_accounts_user_provider ON accounts(userId, provider);

-- Threads: userId + status (used in thread list queries)
CREATE INDEX IF NOT EXISTS idx_threads_user_status ON threads(userId, status);

-- Threads: status + scheduledDate (used by thread scheduler)
CREATE INDEX IF NOT EXISTS idx_threads_status_scheduled ON threads(status, scheduledDate);

-- Sessions: cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expiresAt);

-- Notifications: user + read status
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userId, read);
