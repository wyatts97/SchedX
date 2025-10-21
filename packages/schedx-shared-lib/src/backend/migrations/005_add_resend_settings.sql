-- Migration 005: Add Resend email settings table
-- Stores encrypted Resend API keys and email configuration

CREATE TABLE IF NOT EXISTS resend_settings (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL UNIQUE,
    apiKey TEXT NOT NULL,
    fromEmail TEXT DEFAULT 'noreply@schedx.app',
    fromName TEXT DEFAULT 'SchedX',
    enabled INTEGER DEFAULT 1,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resend_settings_userId ON resend_settings(userId);
CREATE INDEX IF NOT EXISTS idx_resend_settings_enabled ON resend_settings(enabled);
