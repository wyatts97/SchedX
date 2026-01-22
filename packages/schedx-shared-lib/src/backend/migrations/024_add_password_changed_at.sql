-- Add passwordChangedAt column to track when password was last changed
-- This helps identify users still using default passwords

ALTER TABLE users ADD COLUMN passwordChangedAt INTEGER;

-- Set passwordChangedAt to NULL for existing admin user with default password
-- This will trigger forced password change on next login
UPDATE users SET passwordChangedAt = NULL WHERE username = 'admin';
