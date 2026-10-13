-- Migration: 002_economy_fields.sql
-- Description: Add streak insurance and referral tier claim tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_streak_insurance BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS referral_tier_claims (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_level INT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tier_level)
);
