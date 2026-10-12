-- Migration: 016_payment_user_on_delete_set_null.sql
-- Description: Update payments.user_id foreign key constraint to ON DELETE SET NULL to preserve financial audit history when a user account is deleted

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

ALTER TABLE payments
  ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE SET NULL;
