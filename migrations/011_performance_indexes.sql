-- Performance indexes and optimization for Stage I
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_rounds_telegram_id ON rounds(telegram_id);
CREATE INDEX IF NOT EXISTS idx_rounds_created_at ON rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboards(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboards(telegram_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(telegram_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
