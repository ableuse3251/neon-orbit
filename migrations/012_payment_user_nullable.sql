-- Migration: 012_payment_user_nullable.sql
-- Description: Make user_id nullable in payments table for GDPR account deletion with financial audit preservation

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
