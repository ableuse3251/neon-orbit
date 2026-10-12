-- Migration 015: Add language_code to users table for notification engine compatibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'ru';

-- Backfill language_code from language if present
UPDATE users SET language_code = language WHERE language_code IS NULL OR language_code = '';
