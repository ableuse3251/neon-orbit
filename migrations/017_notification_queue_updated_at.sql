-- Migration 017: Add updated_at to notification_queue for stale processing recovery
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
