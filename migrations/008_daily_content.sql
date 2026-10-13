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
