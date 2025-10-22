-- Migration 012: Add support for multiple API keys
-- Allows users to add multiple OpenRouter API keys for rotation

CREATE TABLE IF NOT EXISTS openrouter_api_keys (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    apiKey TEXT NOT NULL,
    label TEXT,
    isActive INTEGER DEFAULT 1,
    lastUsed INTEGER,
    totalRequests INTEGER DEFAULT 0,
    failedRequests INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_openrouter_api_keys_userId ON openrouter_api_keys(userId);
CREATE INDEX IF NOT EXISTS idx_openrouter_api_keys_userId_active ON openrouter_api_keys(userId, isActive);
