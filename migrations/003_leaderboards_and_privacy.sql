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
