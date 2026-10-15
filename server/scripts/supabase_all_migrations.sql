-- ==========================================================================
-- COMBINED SUPABASE MIGRATIONS FOR NEON ORBIT (001 - 020)
-- Project: zqymhgfwqtqjqqcqfeie (Postgres 17)
-- ==========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: 001_initial_schema.sql
-- Migration: 001_initial_schema.sql
-- Description: Create core tables, constraints, and indexes for Neon Orbit

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  language VARCHAR(10) DEFAULT 'ru',
  is_premium BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  referred_by BIGINT,
  is_banned BOOLEAN DEFAULT FALSE,
  shadow_banned BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stardust BIGINT NOT NULL DEFAULT 0 CHECK (stardust >= 0),
  xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1)
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(255) NOT NULL,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(100) DEFAULT 'shop',
  CONSTRAINT unique_user_item UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS equipped (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ship VARCHAR(255) DEFAULT 'ship_default',
  trail VARCHAR(255) DEFAULT 'trail_cyan',
  backdrop VARCHAR(255) DEFAULT 'bg_retro_grid',
  explosion VARCHAR(255) DEFAULT 'exp_neon',
  frame VARCHAR(255) DEFAULT 'frame_none',
  theme VARCHAR(255) DEFAULT 'synthwave'
);

CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed VARCHAR(255) NOT NULL,
  mode VARCHAR(50) NOT NULL CHECK (mode IN ('normal', 'daily', 'challenge')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('issued', 'submitted', 'rejected')),
  score BIGINT DEFAULT 0,
  taps INT DEFAULT 0,
  hits INT DEFAULT 0,
  max_combo INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  flags JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS round_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(255) NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS referrals (
  inviter_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  rewarded_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (inviter_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS daily_claims (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_date DATE NOT NULL,
  streak INT DEFAULT 1,
  PRIMARY KEY (user_id, claim_date)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(255) NOT NULL,
  stars_amount INT NOT NULL,
  telegram_payment_charge_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'created' CHECK (status IN ('created', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
  id VARCHAR(255) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS season_scores (
  season_id VARCHAR(255) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score BIGINT DEFAULT 0,
  rank_title VARCHAR(100) DEFAULT 'Commander',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (season_id, user_id)
);

-- Indexes for performance & leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_rounds_user_id ON rounds(user_id);
CREATE INDEX IF NOT EXISTS idx_rounds_score ON rounds(score DESC);
CREATE INDEX IF NOT EXISTS idx_season_scores_leaderboard ON season_scores(season_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);


INSERT INTO schema_migrations (version) VALUES ('001_initial_schema.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 002_economy_fields.sql
-- Migration: 002_economy_fields.sql
-- Description: Add streak insurance and referral tier claim tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_streak_insurance BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS referral_tier_claims (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_level INT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tier_level)
);


INSERT INTO schema_migrations (version) VALUES ('002_economy_fields.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 003_leaderboards_and_privacy.sql
-- Migration: 003_leaderboards_and_privacy.sql
-- Description: Add privacy setting, user chat tracking, and default season for leaderboards

ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_leaderboard BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_chats (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_user_chats_chat ON user_chats(chat_id);
CREATE INDEX IF NOT EXISTS idx_rounds_mode_status_score ON rounds(mode, status, score DESC);

INSERT INTO seasons (id, title_en, title_ru, starts_at, ends_at, is_active)
VALUES ('season_1', 'Season 1: Neon Storm', 'Сезон 1: Неоновый Шторм', NOW() - INTERVAL '7 days', NOW() + INTERVAL '30 days', TRUE)
ON CONFLICT (id) DO NOTHING;


INSERT INTO schema_migrations (version) VALUES ('003_leaderboards_and_privacy.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 004_admin_and_audit.sql
-- Migration: 004_admin_and_audit.sql
-- Description: Create app_config and audit_log tables for secure admin panel & live ops

CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by BIGINT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id BIGINT NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_id VARCHAR(255),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id);

-- Insert default live event config if missing
INSERT INTO app_config (key, value)
VALUES ('live_event', '{
  "id": "season_1",
  "titleEn": "Season 1: Neon Storm",
  "titleRu": "Сезон 1: Неоновый Шторм",
  "bannerSubtitleEn": "Earn double score during active Golden Hour Surge!",
  "bannerSubtitleRu": "Получайте x2 очков во время Золотого Часа!",
  "eventType": "golden_hour",
  "badgeLabel": "LIVE EVENT",
  "bannerColor": "#00F5D4",
  "isGoldenHourActive": true,
  "goldenHourMultiplier": 2,
  "endDateISO": "2026-12-31T23:59:59Z"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;


INSERT INTO schema_migrations (version) VALUES ('004_admin_and_audit.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 005_notifications_and_audit.sql
-- Migration: 005_notifications_and_audit.sql
-- Description: Add notifications consent column to users, optimize payment charge indexes, and round queries

ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_payments_charge_id ON payments(telegram_payment_charge_id);
CREATE INDEX IF NOT EXISTS idx_rounds_user_started ON rounds(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);


INSERT INTO schema_migrations (version) VALUES ('005_notifications_and_audit.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 006_analytics.sql
-- Migration 006: Analytics events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64),
  name VARCHAR(128) NOT NULL,
  props JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);


INSERT INTO schema_migrations (version) VALUES ('006_analytics.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 007_seasons_upgrade.sql
-- Migration 007: Advanced Seasons & Season Pass Upgrade

-- Ensure seasons table exists
CREATE TABLE IF NOT EXISTS seasons (
  id VARCHAR(255) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE
);

-- Add upgraded columns to seasons
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS theme VARCHAR(64) DEFAULT 'NEON_NEBULA';
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '{}'::jsonb;

-- Ensure season_scores table exists
CREATE TABLE IF NOT EXISTS season_scores (
  season_id VARCHAR(255) NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (season_id, user_id)
);

-- Add upgraded columns to season_scores
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS season_points INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS rounds_played INT DEFAULT 0;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS rank_title VARCHAR(100) DEFAULT 'Pilot';
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS rewards_claimed JSONB DEFAULT '{}'::jsonb;
ALTER TABLE season_scores ADD COLUMN IF NOT EXISTS pass_tier VARCHAR(16) DEFAULT 'FREE';

CREATE INDEX IF NOT EXISTS idx_season_scores_leaderboard ON season_scores(season_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);

-- Ensure initial active season exists if none
INSERT INTO seasons (id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived)
SELECT 'season_1', 'Season 1: Neon Storm', 'Сезон 1: Неоновый Шторм', 'synthwave', NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days', TRUE, FALSE
WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE is_active = TRUE);


INSERT INTO schema_migrations (version) VALUES ('007_seasons_upgrade.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 008_daily_content.sql
-- Migration 008: Daily Content, Challenges, Golden Hours, Events & Streaks

CREATE TABLE IF NOT EXISTS daily_quests (
  id VARCHAR(64) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL, -- score, combo, beacon, rounds, invite
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_dust INTEGER NOT NULL DEFAULT 50,
  reward_exp INTEGER NOT NULL DEFAULT 100,
  reward_cosmetic VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_daily_quests (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  quest_id VARCHAR(64) REFERENCES daily_quests(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target_value INTEGER NOT NULL DEFAULT 1,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  reset_date DATE NOT NULL,
  UNIQUE(user_id, quest_id, reset_date)
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id SERIAL PRIMARY KEY,
  challenge_date DATE UNIQUE NOT NULL,
  seed VARCHAR(128) NOT NULL,
  theme VARCHAR(64) DEFAULT 'NEON_CHALLENGE',
  modifier VARCHAR(64) DEFAULT 'STANDARD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_challenge_scores (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER REFERENCES daily_challenges(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS golden_hours (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.0,
  is_announced BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS limited_events (
  id VARCHAR(64) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  theme_slug VARCHAR(64) NOT NULL, -- halloween, new_year, cosmonautics
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id BIGINT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  streak_freezes_left INTEGER NOT NULL DEFAULT 1,
  is_protected BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default daily quests if empty
INSERT INTO daily_quests (id, title_en, title_ru, type, target_value, reward_dust, reward_exp)
VALUES 
  ('quest_score_1000', 'Score 1,000 points in a round', 'Наберите 1,000 очков в раунде', 'score', 1000, 50, 100),
  ('quest_combo_5', 'Achieve x5 combo multiplier', 'Достигните комбо x5', 'combo', 5, 40, 80),
  ('quest_beacons_3', 'Collect 3 gold beacons', 'Соберите 3 золотых маяка', 'beacon', 3, 60, 120),
  ('quest_rounds_3', 'Play 3 arcade rounds', 'Сыграйте 3 аркадных раунда', 'rounds', 3, 40, 90),
  ('quest_invite_1', 'Invite a friend to Neon Orbit', 'Пригласите друга в Neon Orbit', 'invite', 1, 100, 200)
ON CONFLICT (id) DO NOTHING;


INSERT INTO schema_migrations (version) VALUES ('008_daily_content.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 009_viral_mechanics.sql
-- Migration 009: Viral Mechanics (Challenges, Chat Leaderboards, Referrals V2, Team Goals)

CREATE TABLE IF NOT EXISTS challenges (
  id VARCHAR(64) PRIMARY KEY,
  creator_id BIGINT NOT NULL,
  score INTEGER NOT NULL,
  combo INTEGER NOT NULL,
  seed BIGINT NOT NULL,
  status VARCHAR(32) DEFAULT 'active', -- active, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_leaderboards (
  chat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  total_score INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS referrals_v2 (
  referrer_id BIGINT NOT NULL,
  referred_id BIGINT NOT NULL,
  tier_claimed INTEGER DEFAULT 0,
  status VARCHAR(32) DEFAULT 'pending', -- pending, active (after 1st round)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (referrer_id, referred_id)
);

CREATE TABLE IF NOT EXISTS team_goals (
  id VARCHAR(64) PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ru VARCHAR(255) NOT NULL,
  target_score BIGINT NOT NULL,
  current_score BIGINT DEFAULT 0,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,
  completed BOOLEAN DEFAULT false
);

-- Insert default weekly team goal if none active
INSERT INTO team_goals (id, title_en, title_ru, target_score, current_score, week_start, week_end)
VALUES ('goal_current_week', 'Fleet Weekly Goal: 10M Score', 'Еженедельная цель флота: 10М очков', 10000000, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;


INSERT INTO schema_migrations (version) VALUES ('009_viral_mechanics.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 010_notifications_engine.sql
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


INSERT INTO schema_migrations (version) VALUES ('010_notifications_engine.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 011_performance_indexes.sql
-- Performance indexes and optimization for Stage I
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_rounds_user_started ON rounds(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);


INSERT INTO schema_migrations (version) VALUES ('011_performance_indexes.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 012_payment_user_nullable.sql
-- Migration: 012_payment_user_nullable.sql
-- Description: Make user_id nullable in payments table for GDPR account deletion with financial audit preservation

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;


INSERT INTO schema_migrations (version) VALUES ('012_payment_user_nullable.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 013_inventory_refund_safety.sql
-- Migration: 013_inventory_refund_safety.sql
-- Description: Add payment tracking and acquisition count to inventory for safe idempotent refunds and re-ownership rules

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS acquisition_count INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_inventory_payment_id ON inventory(payment_id);


INSERT INTO schema_migrations (version) VALUES ('013_inventory_refund_safety.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 014_notification_queue_attempts.sql
-- Migration 014: Add retry attempts and max_attempts to notification_queue
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;


INSERT INTO schema_migrations (version) VALUES ('014_notification_queue_attempts.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 015_add_language_code_to_users.sql
-- Migration 015: Add language_code to users table for notification engine compatibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'ru';

-- Backfill language_code from language if present
UPDATE users SET language_code = language WHERE language_code IS NULL OR language_code = '';


INSERT INTO schema_migrations (version) VALUES ('015_add_language_code_to_users.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 016_payment_user_on_delete_set_null.sql
-- Migration: 016_payment_user_on_delete_set_null.sql
-- Description: Update payments.user_id foreign key constraint to ON DELETE SET NULL to preserve financial audit history when a user account is deleted

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE SET NULL;


INSERT INTO schema_migrations (version) VALUES ('016_payment_user_on_delete_set_null.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 017_notification_queue_updated_at.sql
-- Migration 017: Add updated_at to notification_queue for stale processing recovery
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;


INSERT INTO schema_migrations (version) VALUES ('017_notification_queue_updated_at.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 018_scaling_indexes.sql
-- Migration 018: Scaling Indexes for PgBouncer & High-Throughput Workers
-- Optimizes atomic claiming in notification_queue and analytical event queries

CREATE INDEX IF NOT EXISTS idx_notification_queue_claim 
  ON notification_queue(status, scheduled_for, priority);

CREATE INDEX IF NOT EXISTS idx_events_user_created 
  ON events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rounds_user_started_scaling 
  ON rounds(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_queue_stale 
  ON notification_queue(status, updated_at);


INSERT INTO schema_migrations (version) VALUES ('018_scaling_indexes.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 019_payments_reconciliation_queue.sql
-- Migration: 019_payments_reconciliation_queue.sql
-- Description: Add payment_reconciliation_queue table for durable recovery of Telegram Stars fulfillment on transient DB outages

CREATE TABLE IF NOT EXISTS payment_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  telegram_payment_charge_id VARCHAR(255) NOT NULL,
  user_id BIGINT,
  stars_amount INT,
  item_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'dead_letter')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  last_error TEXT,
  correlation_id VARCHAR(255),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_charge_id 
  ON payment_reconciliation_queue(telegram_payment_charge_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_claim 
  ON payment_reconciliation_queue(status, scheduled_for);


INSERT INTO schema_migrations (version) VALUES ('019_payments_reconciliation_queue.sql') ON CONFLICT (version) DO NOTHING;

-- Migration: 020_user_registration_and_avatar.sql
-- Migration: 020_user_registration_and_avatar.sql
-- Description: Add avatar_url and is_registered columns and enforce unique username constraint for registered players

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT FALSE;

-- Unique constraint on lowercase username for registered players
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique 
  ON users (LOWER(username)) 
  WHERE username IS NOT NULL AND username != '' AND is_registered = TRUE;


INSERT INTO schema_migrations (version) VALUES ('020_user_registration_and_avatar.sql') ON CONFLICT (version) DO NOTHING;

COMMIT;
