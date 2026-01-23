-- Migration: Add partialProgress column to threads table for recovery from partial failures
-- This allows threads that fail mid-posting to be resumed from where they left off

ALTER TABLE threads ADD COLUMN partialProgress TEXT DEFAULT NULL;

-- Add index for finding partial_failed threads
CREATE INDEX IF NOT EXISTS idx_threads_partial_failed 
ON threads(status) 
WHERE status = 'partial_failed';
