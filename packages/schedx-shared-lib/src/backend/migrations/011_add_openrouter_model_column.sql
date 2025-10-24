-- Migration 011: Add model column to openrouter_settings table
-- This column was missing from the original table creation

-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- The migration runner will catch and ignore "duplicate column" errors
ALTER TABLE openrouter_settings ADD COLUMN model TEXT DEFAULT 'openai/gpt-3.5-turbo';
