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
