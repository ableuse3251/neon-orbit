-- Migration: 013_inventory_refund_safety.sql
-- Description: Add payment tracking and acquisition count to inventory for safe idempotent refunds and re-ownership rules

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS acquisition_count INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_inventory_payment_id ON inventory(payment_id);
