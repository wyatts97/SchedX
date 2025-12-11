-- SchedX SQLite Schema
-- Migration 020: Add bookmark_count column to tweets table
-- Purpose: Track bookmark counts for published tweets via Rettiwt-API

ALTER TABLE tweets ADD COLUMN bookmarkCount INTEGER DEFAULT 0;
