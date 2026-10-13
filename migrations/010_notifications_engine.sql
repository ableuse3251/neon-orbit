-- Migration 010: Notifications Engine (Prefs, Queue, Logs, A/B Testing)

CREATE TABLE IF NOT EXISTS notification_prefs (
  user_id BIGINT PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  quiet_start INTEGER DEFAULT 23, -- hour 23 (11 PM)
  quiet_end INTEGER DEFAULT 8,    -- hour 8 (8 AM)
  timezone VARCHAR(64) DEFAULT 'UTC',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(64) NOT NULL, -- streak_expiring, friend_overtook, event_start, season_end, daily_challenge, reward_ready
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  ab_variant VARCHAR(16) DEFAULT 'A', -- A or B
  priority INTEGER DEFAULT 5, -- 1 highest, 10 lowest
  status VARCHAR(32) DEFAULT 'pending', -- pending, sent, failed, cancelled, skipped_quiet, skipped_limit
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(64) NOT NULL,
  ab_variant VARCHAR(16) DEFAULT 'A',
  opened BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  opened_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_time ON notification_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(user_id);
