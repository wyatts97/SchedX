-- Migration 011: Add AI usage tracking
-- Tracks AI generation usage for analytics and rate limiting

CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    model TEXT NOT NULL,
    promptTokens INTEGER DEFAULT 0,
    completionTokens INTEGER DEFAULT 0,
    totalTokens INTEGER DEFAULT 0,
    cached INTEGER DEFAULT 0,
    success INTEGER DEFAULT 1,
    errorMessage TEXT,
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_userId ON ai_usage(userId);
CREATE INDEX IF NOT EXISTS idx_ai_usage_createdAt ON ai_usage(createdAt);
CREATE INDEX IF NOT EXISTS idx_ai_usage_userId_createdAt ON ai_usage(userId, createdAt);
