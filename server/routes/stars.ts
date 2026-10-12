import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { query, transaction, isDbActive } from '../db.js';
import { getStarsCatalogItem } from '../../src/shared/stars-catalog.js';
import { createInvoiceSchema } from '../validators.js';

const router = Router();

/**
 * Helper to fulfill a payment atomically and idempotently.
 */
export async function fulfillPayment(paymentId: string, telegramPaymentChargeId: string): Promise<{ success: boolean; alreadyPaid?: boolean; error?: string }> {
  if (!isDbActive()) {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return { success: false, error: 'DATABASE_UNAVAILABLE' };
    }
    console.log(`[PAYMENTS MOCK] DB inactive, fulfilling payment ${paymentId} with charge ${telegramPaymentChargeId}`);
    return { success: true };
  }

  return await transaction(async (client) => {
    // 1. Lock payment row
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
        return { success: true, alreadyPaid: true };
      }
      return { success: false, error: 'PAYMENT_NOT_FOUND' };
    }

    const payment = paymentRes.rows[0];

    // 2. Idempotency Check: Already paid?
    if (payment.status === 'paid' || payment.telegram_payment_charge_id === telegramPaymentChargeId) {
      console.log(`[PAYMENTS] Payment ${paymentId} or charge ${telegramPaymentChargeId} already marked as paid.`);
      return { success: true, alreadyPaid: true };
    }

    // Check if telegram_payment_charge_id was already used elsewhere
    if (telegramPaymentChargeId) {
      const existingCharge = await client.query(
        `SELECT id FROM payments WHERE telegram_payment_charge_id = $1`,
        [telegramPaymentChargeId]
      );
      if (existingCharge.rows.length > 0) {
        const matchedPaymentId = existingCharge.rows[0].id;
        if (matchedPaymentId === paymentId) {
          console.log(`[PAYMENTS] Charge ID ${telegramPaymentChargeId} already processed for payment ${paymentId}.`);
          return { success: true, alreadyPaid: true };
        } else {
          console.error(`[PAYMENTS SECURITY ERROR] Charge ID ${telegramPaymentChargeId} already used by different payment ${matchedPaymentId} (attempted on ${paymentId}).`);
          return { success: false, error: 'CHARGE_ID_ALREADY_USED_BY_ANOTHER_PAYMENT' };
        }
      }
    }

    const item = getStarsCatalogItem(payment.item_id);
    if (!item) {
      return { success: false, error: 'ITEM_NOT_FOUND_IN_CATALOG' };
    }

    // 3. Mark payment as paid
    await client.query(
      `UPDATE payments
       SET status = 'paid', telegram_payment_charge_id = $1
       WHERE id = $2`,
      [telegramPaymentChargeId, payment.id]
    );

    // 4. Grant reward to user based on item type
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

    console.log(`[PAYMENTS SUCCESS] User ${userId} successfully purchased ${item.id} (${item.priceStars} XTR), chargeId: ${telegramPaymentChargeId}`);
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
    console.log(`[REFUND MOCK] DB inactive, refunding user ${userId} charge ${telegramPaymentChargeId}`);
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
            console.log(`[REFUND] Item ${shipId} for user ${userId} acquired from another payment/source (payment_id: ${inv.payment_id}), retaining in inventory.`);
          }
        }
      }
    }

    console.log(`[REFUND SUCCESS] Refunded payment ${payment.id} for user ${userId}, chargeId: ${telegramPaymentChargeId}`);
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

  try {
    const paymentId = crypto.randomUUID();

    // 1. Insert payment record into DB
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
      console.error('[PAYMENTS ERROR] Telegram createInvoiceLink failed:', tgData);
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
    console.error('[PAYMENTS ERROR] create-invoice exception:', err);
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
      console.error('[PAYMENTS STATUS ERROR]', err);
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

  const { paymentId, chargeId } = req.body;
  if (!paymentId || !chargeId) {
    return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
  }

  const result = await fulfillPayment(paymentId, chargeId);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

export default router;
