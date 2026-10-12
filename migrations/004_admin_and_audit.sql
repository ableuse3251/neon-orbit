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
