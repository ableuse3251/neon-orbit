-- Migration: 005_notifications_and_audit.sql
-- Description: Add notifications consent column to users, optimize payment charge indexes, and round queries

ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_payments_charge_id ON payments(telegram_payment_charge_id);
CREATE INDEX IF NOT EXISTS idx_rounds_user_started ON rounds(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
