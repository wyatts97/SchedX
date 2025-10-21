-- Migration 004: Add OpenRouter settings table
-- Stores encrypted OpenRouter API keys and configuration

CREATE TABLE IF NOT EXISTS openrouter_settings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    apiKey TEXT NOT NULL,
    defaultModel TEXT DEFAULT 'meta-llama/llama-4-scout:free',
    enabled INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_openrouter_settings_userId ON openrouter_settings(userId);
CREATE INDEX IF NOT EXISTS idx_openrouter_settings_enabled ON openrouter_settings(enabled);
