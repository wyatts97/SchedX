-- Migration 006: Add avatar column to users table
-- Allows users to upload custom profile avatars

ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT NULL;
