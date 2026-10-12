-- Migration 014: Add retry attempts and max_attempts to notification_queue
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
