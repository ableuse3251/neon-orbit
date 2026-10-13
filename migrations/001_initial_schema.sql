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
