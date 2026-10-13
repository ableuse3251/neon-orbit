import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { query, transaction, isDbActive } from '../db.js';
import { getStarsCatalogItem } from '../../src/shared/stars-catalog.js';
import { createInvoiceSchema } from '../validators.js';
import { logger } from '../logger.js';

const router = Router();

export interface FulfillPaymentOptions {
  expectedUserId?: number | string;
  expectedAmount?: number;
  expectedCurrency?: string;
}

export interface FulfillPaymentResult {
  success: boolean;
  alreadyPaid?: boolean;
  error?: string;
  reconciliationQueued?: boolean;
  correlationId?: string;
}

/**
 * In-memory fallback queue for temporary DB connection loss
 * Flushed automatically when DB reconnects.
 */
interface InMemoryReconciliationItem {
  paymentId: string;
  telegramPaymentChargeId: string;
  userId?: number | string;
  starsAmount?: number;
  itemId?: string;
  attempts: number;
  maxAttempts: number;
  lastError: string;
  correlationId: string;
  scheduledFor: number;
}

const inMemoryReconciliationQueue: InMemoryReconciliationItem[] = [];

/**
 * Enqueue payment fulfillment into durable reconciliation queue (DB or in-memory fallback)
 */
export async function enqueuePaymentReconciliation(
  paymentId: string,
  telegramPaymentChargeId: string,
  options?: {
    userId?: number | string;
    starsAmount?: number;
    itemId?: string;
    error?: string;
    correlationId?: string;
  }
): Promise<{ success: boolean; correlationId: string }> {
  const correlationId = options?.correlationId || `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const lastError = options?.error || 'TRANSIENT_DB_FAILURE';

  if (isDbActive()) {
    try {
      await query(
        `INSERT INTO payment_reconciliation_queue 
          (payment_id, telegram_payment_charge_id, user_id, stars_amount, item_id, status, attempts, max_attempts, last_error, correlation_id, scheduled_for, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', 0, 5, $6, $7, NOW(), NOW())
         ON CONFLICT (telegram_payment_charge_id) DO UPDATE 
           SET status = CASE WHEN payment_reconciliation_queue.status = 'completed' THEN 'completed' ELSE 'pending' END,
               attempts = payment_reconciliation_queue.attempts,
               last_error = EXCLUDED.last_error,
               correlation_id = EXCLUDED.correlation_id,
               updated_at = NOW()`,
        [
          paymentId,
          telegramPaymentChargeId,
          options?.userId ? Number(options.userId) : null,
          options?.starsAmount ? Number(options.starsAmount) : null,
          options?.itemId || null,
          lastError,
          correlationId,
        ]
      );
      logger.info(`[PAYMENTS RECONCILIATION] Enqueued payment ${paymentId} (charge: ${telegramPaymentChargeId}) into DB reconciliation queue`, { correlationId });
      return { success: true, correlationId };
    } catch (dbErr: any) {
      logger.error(`[PAYMENTS RECONCILIATION] Failed to insert into DB queue: ${dbErr?.message || dbErr}`, { correlationId });
      if (config.nodeEnv === 'production') {
        return { success: false, correlationId };
      }
    }
  } else if (config.nodeEnv === 'production') {
    logger.error(`[PAYMENTS RECONCILIATION CRITICAL] Database inactive in production when attempting to enqueue payment ${paymentId}`, { correlationId });
    return { success: false, correlationId };
  }

  // In-memory fallback
  const existingIdx = inMemoryReconciliationQueue.findIndex((item) => item.telegramPaymentChargeId === telegramPaymentChargeId);
  if (existingIdx === -1) {
    inMemoryReconciliationQueue.push({
      paymentId,
      telegramPaymentChargeId,
      userId: options?.userId,
      starsAmount: options?.starsAmount,
      itemId: options?.itemId,
      attempts: 0,
      maxAttempts: 5,
      lastError,
      correlationId,
      scheduledFor: Date.now(),
    });
  } else {
    inMemoryReconciliationQueue[existingIdx].lastError = lastError;
    inMemoryReconciliationQueue[existingIdx].correlationId = correlationId;
  }

  logger.warn(`[PAYMENTS RECONCILIATION] Stored payment in in-memory reconciliation queue (queue size: ${inMemoryReconciliationQueue.length})`, { correlationId, paymentId });
  return { success: true, correlationId };
}

/**
 * Reconcile pending payments queue. Called periodically or on DB reconnection.
 */
export async function reconcilePendingPayments(): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  if (!isDbActive()) {
    return { processed, succeeded, failed };
  }

  // 1. Flush in-memory queue to DB or directly process
  while (inMemoryReconciliationQueue.length > 0) {
    const memItem = inMemoryReconciliationQueue.shift();
    if (!memItem) break;
    processed++;
    try {
      const fulfillRes = await fulfillPayment(memItem.paymentId, memItem.telegramPaymentChargeId, {
        expectedUserId: memItem.userId,
        expectedAmount: memItem.starsAmount,
      });
      if (fulfillRes.success) {
        succeeded++;
        logger.info(`[RECONCILIATION] Successfully processed in-memory payment ${memItem.paymentId} (charge: ${memItem.telegramPaymentChargeId})`, { correlationId: memItem.correlationId });
      } else {
        failed++;
        memItem.attempts++;
        if (memItem.attempts < memItem.maxAttempts) {
          memItem.scheduledFor = Date.now() + Math.pow(2, memItem.attempts) * 2000;
          inMemoryReconciliationQueue.push(memItem);
        } else {
          logger.error(`[RECONCILIATION DEAD-LETTER] In-memory payment ${memItem.paymentId} permanently failed: ${fulfillRes.error}`, { correlationId: memItem.correlationId });
        }
      }
    } catch (err: any) {
      failed++;
      memItem.attempts++;
      if (memItem.attempts < memItem.maxAttempts) {
        inMemoryReconciliationQueue.push(memItem);
      }
    }
  }

  // 2. Process DB payment_reconciliation_queue rows
  try {
    const { rows } = await query(
      `UPDATE payment_reconciliation_queue
       SET status = 'processing', updated_at = NOW()
       WHERE id IN (
         SELECT q.id
         FROM payment_reconciliation_queue q
         WHERE q.status = 'pending' AND q.scheduled_for <= NOW()
         ORDER BY q.created_at ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, payment_id, telegram_payment_charge_id, user_id, stars_amount, attempts, max_attempts, correlation_id`
    );

    if (rows && rows.length > 0) {
      for (const row of rows) {
        processed++;
        const attempts = Number(row.attempts || 0) + 1;
        const maxAttempts = Number(row.max_attempts || 5);

        try {
          const res = await fulfillPayment(row.payment_id, row.telegram_payment_charge_id, {
            expectedUserId: row.user_id,
            expectedAmount: row.stars_amount,
          });

          if (res.success) {
            succeeded++;
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'completed', attempts = $1, updated_at = NOW()
               WHERE id = $2`,
              [attempts, row.id]
            );
            logger.info(`[RECONCILIATION] Completed reconciliation for payment ${row.payment_id}`, { correlationId: row.correlation_id });
          } else {
            failed++;
            if (attempts >= maxAttempts) {
              await query(
                `UPDATE payment_reconciliation_queue 
                 SET status = 'dead_letter', attempts = $1, last_error = $2, updated_at = NOW()
                 WHERE id = $3`,
                [attempts, res.error || 'UNKNOWN_ERROR', row.id]
              );
              logger.error(`[RECONCILIATION DEAD-LETTER] Payment ${row.payment_id} exceeded max attempts`, { correlationId: row.correlation_id, error: res.error });
            } else {
              const backoffSec = Math.pow(2, attempts) * 3;
              await query(
                `UPDATE payment_reconciliation_queue 
                 SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, last_error = $3, updated_at = NOW()
                 WHERE id = $4`,
                [attempts, backoffSec, res.error || 'RETRY', row.id]
              );
            }
          }
        } catch (err: any) {
          failed++;
          const errStr = String(err?.message || err);
          if (attempts >= maxAttempts) {
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'dead_letter', attempts = $1, last_error = $2, updated_at = NOW()
               WHERE id = $3`,
              [attempts, errStr, row.id]
            );
          } else {
            const backoffSec = Math.pow(2, attempts) * 3;
            await query(
              `UPDATE payment_reconciliation_queue 
               SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, last_error = $3, updated_at = NOW()
               WHERE id = $4`,
              [attempts, backoffSec, errStr, row.id]
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error('[RECONCILIATION] Error processing reconciliation queue:', err);
  }

  return { processed, succeeded, failed };
}

/**
 * Helper to fulfill a payment atomically and idempotently.
 * Enforces ownership, currency, amount, status transitions ('created' -> 'paid'),
 * and strict charge ID uniqueness.
 */
export async function fulfillPayment(
  paymentId: string,
  telegramPaymentChargeId: string,
  options?: FulfillPaymentOptions
): Promise<FulfillPaymentResult> {
  if (!isDbActive()) {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return { success: false, error: 'DATABASE_UNAVAILABLE' };
    }
    logger.info(`[PAYMENTS MOCK] DB inactive, fulfilling payment ${paymentId} with charge ${telegramPaymentChargeId}`);
    return { success: true };
  }

  return await transaction(async (client) => {
    // 1. Lock payment row by ID
    const paymentRes = await client.query(
      `SELECT id, user_id, item_id, stars_amount, status, telegram_payment_charge_id
       FROM payments
       WHERE id = $1 FOR UPDATE`,
      [paymentId]
    );

    if (paymentRes.rows.length === 0) {
      // Check if maybe searched by charge id
      const chargeRes = await client.query(
        `SELECT id, user_id, item_id, stars_amount, status, telegram_payment_charge_id
         FROM payments
         WHERE telegram_payment_charge_id = $1 FOR UPDATE`,
        [telegramPaymentChargeId]
      );
      if (chargeRes.rows.length > 0) {
        const matchedPayment = chargeRes.rows[0];
        // Ensure user mismatch check if user provided
        if (options?.expectedUserId && String(matchedPayment.user_id) !== String(options.expectedUserId)) {
          return { success: false, error: 'USER_MISMATCH' };
        }
        return { success: true, alreadyPaid: true };
      }
      return { success: false, error: 'PAYMENT_NOT_FOUND' };
    }

    const payment = paymentRes.rows[0];

    // 2. Strict User Ownership Check
    if (options?.expectedUserId !== undefined && options.expectedUserId !== null) {
      if (String(payment.user_id) !== String(options.expectedUserId)) {
        logger.error(`[PAYMENTS SECURITY] User mismatch on payment ${paymentId}: expected ${options.expectedUserId}, found ${payment.user_id}`);
        return { success: false, error: 'USER_MISMATCH' };
      }
    }

    // 3. Amount & Currency Verification
    if (options?.expectedAmount !== undefined && options.expectedAmount !== null) {
      if (Number(payment.stars_amount) !== Number(options.expectedAmount)) {
        logger.error(`[PAYMENTS SECURITY] Amount mismatch on payment ${paymentId}: expected ${options.expectedAmount}, order is ${payment.stars_amount}`);
        return { success: false, error: 'AMOUNT_MISMATCH' };
      }
    }
    if (options?.expectedCurrency && options.expectedCurrency.toUpperCase() !== 'XTR') {
      return { success: false, error: 'INVALID_CURRENCY' };
    }

    // 4. Idempotency Check & Status Verification
    if (payment.status === 'paid') {
      // Order is already marked paid. Verify charge ID matches!
      if (payment.telegram_payment_charge_id === telegramPaymentChargeId) {
        logger.info(`[PAYMENTS] Payment ${paymentId} already marked as paid with matching charge ID ${telegramPaymentChargeId}.`);
        return { success: true, alreadyPaid: true };
      } else {
        // Someone is attempting to use a second payment charge ID on an already fulfilled order!
        logger.error(`[PAYMENTS SECURITY ERROR] Order ${paymentId} is already paid under charge ${payment.telegram_payment_charge_id}, but received different charge ID ${telegramPaymentChargeId}. Rejecting second fulfillment.`);
        return { success: false, error: 'ORDER_ALREADY_FULFILLED_WITH_DIFFERENT_CHARGE' };
      }
    }

    if (payment.status === 'refunded') {
      logger.error(`[PAYMENTS SECURITY ERROR] Order ${paymentId} is marked as refunded. Cannot fulfill.`);
      return { success: false, error: 'ORDER_ALREADY_REFUNDED' };
    }

    // Order must be in 'created' status to be fulfilled
    if (payment.status !== 'created') {
      logger.error(`[PAYMENTS ERROR] Payment ${paymentId} has invalid status '${payment.status}' (expected 'created').`);
      return { success: false, error: 'INVALID_PAYMENT_STATUS' };
    }

    // 5. Global Charge ID Uniqueness: Check if charge ID was already used by ANY other payment
    if (telegramPaymentChargeId) {
      const existingCharge = await client.query(
        `SELECT id, user_id FROM payments WHERE telegram_payment_charge_id = $1`,
        [telegramPaymentChargeId]
      );
      if (existingCharge.rows.length > 0) {
        const matchedPaymentId = existingCharge.rows[0].id;
        if (matchedPaymentId === paymentId) {
          logger.info(`[PAYMENTS] Charge ID ${telegramPaymentChargeId} already recorded for payment ${paymentId}.`);
          return { success: true, alreadyPaid: true };
        } else {
          logger.error(`[PAYMENTS SECURITY ERROR] Charge ID ${telegramPaymentChargeId} already used by different payment ${matchedPaymentId} (attempted on ${paymentId}).`);
          return { success: false, error: 'CHARGE_ID_ALREADY_USED_BY_ANOTHER_PAYMENT' };
        }
      }
    }

    const item = getStarsCatalogItem(payment.item_id);
    if (!item) {
      return { success: false, error: 'ITEM_NOT_FOUND_IN_CATALOG' };
    }

    // Verify catalog price matches recorded payment price
    if (item.priceStars !== Number(payment.stars_amount)) {
      logger.error(`[PAYMENTS SECURITY] Catalog price mismatch: catalog=${item.priceStars}, recorded=${payment.stars_amount}`);
      return { success: false, error: 'CATALOG_PRICE_MISMATCH' };
    }

    // 6. Mark payment as paid
    await client.query(
      `UPDATE payments
       SET status = 'paid', telegram_payment_charge_id = $1
       WHERE id = $2`,
      [telegramPaymentChargeId, payment.id]
    );

    // 7. Grant reward to user based on item type
    const userId = payment.user_id;

    if (item.id === 'season_pass_paid') {
      const seasonRes = await client.query(`SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1`);
      if (seasonRes.rows.length > 0) {
        const seasonId = seasonRes.rows[0].id;
        await client.query(
          `INSERT INTO season_scores (season_id, user_id, pass_tier) VALUES ($1, $2, 'PAID')
           ON CONFLICT (season_id, user_id) DO UPDATE SET pass_tier = 'PAID'`,
          [seasonId, userId]
        );
      }
    }

    if (item.rewardStardustBonus && item.rewardStardustBonus > 0) {
      await client.query(
        `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
        [item.rewardStardustBonus, userId]
      );
    }

    if (item.type === 'insurance') {
      await client.query(
        `UPDATE users SET has_streak_insurance = TRUE WHERE id = $1`,
        [userId]
      );
    }

    const shipId = item.rewardShipId || item.rewardCosmeticId;
    if (shipId) {
      await client.query(
        `INSERT INTO inventory (user_id, item_id, source, payment_id, acquisition_count)
         VALUES ($1, $2, 'stars_shop', $3, 1)
         ON CONFLICT (user_id, item_id) 
         DO UPDATE SET acquisition_count = inventory.acquisition_count + 1, payment_id = COALESCE(EXCLUDED.payment_id, inventory.payment_id)`,
        [userId, shipId, payment.id]
      );
    }

    logger.info(`[PAYMENTS SUCCESS] User ${userId} successfully purchased ${item.id} (${item.priceStars} XTR), chargeId: ${telegramPaymentChargeId}`);
    return { success: true };
  });
}

/**
 * Helper to process a refund for an admin (F06 / NE-05).
 * Sets status to refunded only after confirmed validation and handles inventory re-acquisition safety.
 */
export async function refundPayment(userId: number | string, telegramPaymentChargeId: string): Promise<{ success: boolean; error?: string }> {
  if (!isDbActive()) {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return { success: false, error: 'DATABASE_UNAVAILABLE' };
    }
    logger.info(`[REFUND MOCK] DB inactive, refunding user ${userId} charge ${telegramPaymentChargeId}`);
    return { success: true };
  }

  return await transaction(async (client) => {
    // 1. Find paid payment with row lock
    const paymentRes = await client.query(
      `SELECT id, user_id, item_id, status
       FROM payments
       WHERE telegram_payment_charge_id = $1 AND user_id = $2 FOR UPDATE`,
      [telegramPaymentChargeId, userId]
    );

    if (paymentRes.rows.length === 0) {
      return { success: false, error: 'PAYMENT_NOT_FOUND' };
    }

    const payment = paymentRes.rows[0];
    if (payment.status === 'refunded') {
      return { success: true };
    }

    if (payment.status !== 'paid') {
      return { success: false, error: 'PAYMENT_NOT_PAID' };
    }

    // 2. Mark as refunded (after Telegram Stars refund confirmation)
    await client.query(
      `UPDATE payments SET status = 'refunded' WHERE id = $1`,
      [payment.id]
    );

    // 3. Revoke items safely (respecting re-acquisition rules and ownership source)
    const item = getStarsCatalogItem(payment.item_id);
    if (item) {
      if (item.rewardStardustBonus && item.rewardStardustBonus > 0) {
        await client.query(
          `UPDATE wallets SET stardust = GREATEST(0, stardust - $1) WHERE user_id = $2`,
          [item.rewardStardustBonus, userId]
        );
      }

      if (item.type === 'insurance') {
        await client.query(
          `UPDATE users SET has_streak_insurance = FALSE WHERE id = $1`,
          [userId]
        );
      }

      const shipId = item.rewardShipId || item.rewardCosmeticId;
      if (shipId) {
        const invRes = await client.query(
          `SELECT acquisition_count, payment_id FROM inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE`,
          [userId, shipId]
        );
        if (invRes.rows.length > 0) {
          const inv = invRes.rows[0];
          const count = Number(inv.acquisition_count || 1);
          if (count > 1) {
            await client.query(
              `UPDATE inventory SET acquisition_count = acquisition_count - 1 WHERE user_id = $1 AND item_id = $2`,
              [userId, shipId]
            );
          } else if (inv.payment_id === payment.id || inv.payment_id === null) {
            await client.query(
              `DELETE FROM inventory WHERE user_id = $1 AND item_id = $2`,
              [userId, shipId]
            );
          } else {
            logger.info(`[REFUND] Item ${shipId} for user ${userId} acquired from another payment/source (payment_id: ${inv.payment_id}), retaining in inventory.`);
          }
        }
      }
    }

    logger.info(`[REFUND SUCCESS] Refunded payment ${payment.id} for user ${userId}, chargeId: ${telegramPaymentChargeId}`);
    return { success: true };
  });
}

/**
 * POST /api/stars/create-invoice (requireAuth)
 * Accepts ONLY { itemId } in req.body.
 * Retrieves title, description, and priceStars from server catalog (shared/stars-catalog.ts).
 */
router.post('/stars/create-invoice', requireAuth, async (req: Request, res: Response) => {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'INVALID_ITEM_ID', details: parsed.error.issues });
  }
  const { itemId } = parsed.data;
  const user = (req as any).user;

  const catalogItem = getStarsCatalogItem(itemId);
  if (!catalogItem) {
    return res.status(400).json({ success: false, error: 'ITEM_NOT_FOUND_IN_CATALOG' });
  }

  // Ensure DB is available in production before initiating an invoice
  if (!isDbActive() && (config.nodeEnv === 'production' || !config.mockModeAllowed)) {
    return res.status(503).json({
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'Payment system is temporarily unavailable. Please try again later.',
    });
  }

  try {
    const paymentId = crypto.randomUUID();

    // 1. Insert payment record into DB with status 'created'
    await query(
      `INSERT INTO payments (id, user_id, item_id, stars_amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'created', NOW())`,
      [paymentId, user.id, catalogItem.id, catalogItem.priceStars]
    );

    // 2. Check bot token availability
    if (!config.botToken) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN is not configured on the server',
      });
    }

    // 3. Call official Telegram createInvoiceLink API
    const payload = JSON.stringify({ paymentId, userId: user.id, itemId: catalogItem.id });

    const tgResponse = await fetch(`https://api.telegram.org/bot${config.botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: catalogItem.titleEn,
        description: catalogItem.descEn,
        payload,
        currency: 'XTR',
        prices: [{ label: catalogItem.titleEn, amount: catalogItem.priceStars }],
      }),
    });

    const tgData = await tgResponse.json();

    if (!tgData.ok) {
      logger.error('[PAYMENTS ERROR] Telegram createInvoiceLink failed:', tgData);
      return res.status(400).json({
        success: false,
        error: tgData.description || 'TELEGRAM_INVOICE_ERROR',
      });
    }

    return res.json({
      success: true,
      invoiceUrl: tgData.result,
      paymentId,
    });
  } catch (err: any) {
    logger.error('[PAYMENTS ERROR] create-invoice exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'INTERNAL_SERVER_ERROR',
    });
  }
});

/**
 * GET /api/stars/status/:paymentId (requireAuth)
 * Safely check the status of a payment (created, paid, refunded) without altering data.
 */
router.get('/stars/status/:paymentId', requireAuth, async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const user = (req as any).user;

  if (!paymentId) {
    return res.status(400).json({ success: false, error: 'MISSING_PAYMENT_ID' });
  }

  if (isDbActive()) {
    try {
      const resDb = await query(
        `SELECT id, user_id, item_id, stars_amount, status, created_at, telegram_payment_charge_id
         FROM payments WHERE id = $1 AND user_id = $2`,
        [paymentId, user.id]
      );

      if (resDb.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
      }

      const p = resDb.rows[0];
      return res.json({
        success: true,
        paymentId: p.id,
        itemId: p.item_id,
        starsAmount: Number(p.stars_amount),
        status: p.status,
        isPaid: p.status === 'paid',
      });
    } catch (err: any) {
      logger.error('[PAYMENTS STATUS ERROR]', err);
      return res.status(500).json({ success: false, error: 'DATABASE_ERROR' });
    }
  }

  if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable in production',
      message: 'Service temporarily unavailable. Database required.',
    });
  }

  return res.json({
    success: true,
    paymentId,
    status: 'paid',
    isPaid: true,
  });
});

/**
 * POST /api/stars/fulfill (TEST / DEV ONLY)
 * In production, payments are strictly fulfilled via the Telegram Bot webhook (message:successful_payment).
 * Direct invocation is strictly forbidden in production to prevent balance / item fraud.
 */
router.post('/stars/fulfill', requireAuth, async (req: Request, res: Response) => {
  if (config.nodeEnv === 'production') {
    return res.status(403).json({
      success: false,
      error: 'DIRECT_FULFILLMENT_FORBIDDEN',
      message: 'In production, Stars payments are fulfilled exclusively via official Telegram Bot webhooks.',
    });
  }

  const { paymentId, chargeId, expectedUserId, expectedAmount } = req.body;
  if (!paymentId || !chargeId) {
    return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
  }

  const result = await fulfillPayment(paymentId, chargeId, {
    expectedUserId,
    expectedAmount,
  });
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// Periodic background runner for payment reconciliation (every 20s)
let reconciliationInterval: NodeJS.Timeout | null = null;
export function startPaymentReconciliationWorker(intervalMs = 20000): void {
  if (reconciliationInterval) return;
  reconciliationInterval = setInterval(() => {
    reconcilePendingPayments().catch((err) => logger.error('Payment reconciliation error:', err));
  }, intervalMs);
}

export function stopPaymentReconciliationWorker(): void {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
  }
}

// Auto-start reconciliation worker
const appRole = (process.env.APP_ROLE || process.env.ROLE || 'all').toLowerCase();
if (appRole === 'all' || appRole === 'worker') {
  startPaymentReconciliationWorker();
}

export default router;
