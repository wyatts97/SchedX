-- Migration 010: Fix prompt history table (remove unique constraint)
-- This fixes the issue where the unique constraint was preventing history saves

-- Drop the unique index if it exists
DROP INDEX IF EXISTS idx_prompt_history_unique;

-- Recreate tables if they don't exist (in case migration 009 failed)
CREATE TABLE IF NOT EXISTS saved_prompts (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    prompt TEXT NOT NULL,
    tone TEXT,
    length TEXT,
    usageCount INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_prompts_userId ON saved_prompts(userId);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_createdAt ON saved_prompts(userId, createdAt DESC);

CREATE TABLE IF NOT EXISTS prompt_history (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    prompt TEXT NOT NULL,
    tone TEXT,
    length TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prompt_history_userId ON prompt_history(userId);
CREATE INDEX IF NOT EXISTS idx_prompt_history_createdAt ON prompt_history(userId, createdAt DESC);
