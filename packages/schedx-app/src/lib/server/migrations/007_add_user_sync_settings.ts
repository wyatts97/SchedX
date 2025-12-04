/**
 * Migration: Add user_sync_settings table
 * Stores user preferences for engagement sync scheduling and tracks sync status
 */

export const up = `
CREATE TABLE IF NOT EXISTS user_sync_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sync_time TEXT NOT NULL DEFAULT '03:00',
  last_sync_at INTEGER,
  last_sync_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sync_settings_user_id ON user_sync_settings(user_id);
`;

export const down = `
DROP TABLE IF EXISTS user_sync_settings;
`;
