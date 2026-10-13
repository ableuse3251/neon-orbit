-- Migration 018: Scaling Indexes for PgBouncer & High-Throughput Workers
-- Optimizes atomic claiming in notification_queue and analytical event queries

CREATE INDEX IF NOT EXISTS idx_notification_queue_claim 
  ON notification_queue(status, scheduled_for, priority);

CREATE INDEX IF NOT EXISTS idx_events_user_created 
  ON events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rounds_user_created 
  ON rounds(telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_stale 
  ON notification_queue(status, updated_at);
