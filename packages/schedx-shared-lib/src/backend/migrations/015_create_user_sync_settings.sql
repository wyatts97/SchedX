-- Migration 015: Create user_sync_settings table
-- This table stores user preferences for engagement sync timing and tracks sync status

CREATE TABLE IF NOT EXISTS user_sync_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    sync_time TEXT NOT NULL DEFAULT '03:00',
    last_sync_at INTEGER,
    last_sync_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add index for quick lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_sync_settings_user_id ON user_sync_settings(user_id);
