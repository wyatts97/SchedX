-- Migration 016: Add followerCount column to accounts table
-- This column stores the follower count synced from Twitter/X via Rettiwt API

ALTER TABLE accounts ADD COLUMN followerCount INTEGER DEFAULT 0;
