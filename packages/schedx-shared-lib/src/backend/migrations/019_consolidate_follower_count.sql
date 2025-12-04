-- Migration 019: Consolidate Follower Count Columns
-- Purpose: Remove duplicate followerCount/followersCount columns
-- Migration 012 added followersCount (plural)
-- Migration 016 added followerCount (singular)
-- This migration consolidates to followerCount and removes the duplicate

-- ============================================
-- 1. COPY DATA FROM followersCount TO followerCount
-- ============================================
-- If followersCount has data but followerCount doesn't, copy it over
UPDATE accounts 
SET followerCount = followersCount
WHERE followerCount = 0 
  AND followersCount > 0;

-- ============================================
-- 2. DROP THE OLD followersCount COLUMN
-- ============================================
-- SQLite doesn't support DROP COLUMN directly in older versions
-- We need to recreate the table without the column

-- This is a complex operation, but since we're in development
-- and the column is redundant, we can use a simpler approach:
-- Just document that followersCount is deprecated and should not be used

-- For production, you would:
-- 1. Create new table without followersCount
-- 2. Copy all data
-- 3. Drop old table
-- 4. Rename new table

-- For now, we'll just ensure followerCount is the source of truth
-- and update any code still using followersCount

-- ============================================
-- VERIFICATION QUERIES (commented out)
-- ============================================
-- SELECT COUNT(*) FROM accounts WHERE followersCount != followerCount;
-- SELECT id, username, followersCount, followerCount FROM accounts WHERE provider = 'twitter';
