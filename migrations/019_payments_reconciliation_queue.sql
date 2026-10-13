-- Migration: 019_payments_reconciliation_queue.sql
-- Description: Add payment_reconciliation_queue table for durable recovery of Telegram Stars fulfillment on transient DB outages

CREATE TABLE IF NOT EXISTS payment_reconciliation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  telegram_payment_charge_id VARCHAR(255) NOT NULL,
  user_id BIGINT,
  stars_amount INT,
  item_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'dead_letter')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  last_error TEXT,
  correlation_id VARCHAR(255),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_charge_id 
  ON payment_reconciliation_queue(telegram_payment_charge_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_claim 
  ON payment_reconciliation_queue(status, scheduled_for);
