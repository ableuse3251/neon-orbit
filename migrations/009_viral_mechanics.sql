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
