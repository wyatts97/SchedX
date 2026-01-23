-- Migration: Add indexes for scheduling optimization
-- Improves performance of due tweet queries and conflict checking

-- Index for finding due tweets efficiently (status + scheduledDate)
-- This is a partial index that only includes scheduled tweets
CREATE INDEX IF NOT EXISTS idx_tweets_due_scheduled 
ON tweets(status, scheduledDate) 
WHERE status = 'scheduled';

-- Index for finding queued tweets by position
CREATE INDEX IF NOT EXISTS idx_tweets_queued_position 
ON tweets(userId, twitterAccountId, status, queuePosition) 
WHERE status = 'queued';

-- Index for conflict checking (account + status + scheduledDate range)
CREATE INDEX IF NOT EXISTS idx_tweets_schedule_conflict 
ON tweets(userId, twitterAccountId, status, scheduledDate);

-- Index for thread scheduling
CREATE INDEX IF NOT EXISTS idx_threads_due_scheduled 
ON threads(status, scheduledDate) 
WHERE status = 'scheduled';
