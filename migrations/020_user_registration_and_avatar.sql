-- Migration: 020_user_registration_and_avatar.sql
-- Description: Add avatar_url and is_registered columns and enforce unique username constraint for registered players

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT FALSE;

-- Unique constraint on lowercase username for registered players
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique 
  ON users (LOWER(username)) 
  WHERE username IS NOT NULL AND username != '' AND is_registered = TRUE;
