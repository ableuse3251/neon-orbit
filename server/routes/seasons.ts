import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { query, transaction, isDbActive } from '../db.js';
import { config } from '../config.js';
import { getActiveSeason, getUserSeasonData, DEFAULT_SEASON_TIERS } from '../services/seasons.js';
import { getStarsCatalogItem } from '../../src/shared/stars-catalog.js';

const router = Router();

/**
 * GET /api/seasons/active
 * Returns current active season and user's season progress & tier rewards
 */
router.get('/seasons/active', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: 'Database inactive' });
  }

  try {
    const data = await getUserSeasonData(userId);
    if (!data) {
      return res.status(404).json({ success: false, error: 'No active season found' });
    }

    res.json({
      success: true,
      season: data.season,
      userStats: data.userStats,
      tiers: data.tiers,
    });
  } catch (err) {
    console.error('Error in GET /api/seasons/active:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/seasons/claim
 * Claim season pass reward for a specific tier
 */
router.post('/seasons/claim', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { tierIndex, isPaid } = req.body; // isPaid: boolean

  if (tierIndex === undefined || tierIndex < 0 || tierIndex >= DEFAULT_SEASON_TIERS.length) {
    return res.status(400).json({ success: false, error: 'Invalid tier index' });
  }

  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: 'Database inactive' });
  }

  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(404).json({ success: false, error: 'No active season' });
    }

    const tierObj = DEFAULT_SEASON_TIERS[tierIndex];

    const result = await transaction(async (client) => {
      // Get user season stats
      const sRes = await client.query(
        `SELECT season_points, rewards_claimed, pass_tier FROM season_scores WHERE season_id = $1 AND user_id = $2 FOR UPDATE`,
        [season.id, userId]
      );

      if (sRes.rows.length === 0) {
        throw new Error('SEASON_NOT_STARTED_FOR_USER');
      }

      const row = sRes.rows[0];
      const seasonPoints = Number(row.season_points) || 0;
      const passTier = row.pass_tier || 'FREE';
      const rewardsClaimed = row.rewards_claimed || {};

      if (seasonPoints < tierObj.pointsRequired) {
        throw new Error('INSUFFICIENT_SEASON_POINTS');
      }

      const claimKey = isPaid ? `paid_${tierIndex}` : `free_${tierIndex}`;
      if (rewardsClaimed[claimKey]) {
        throw new Error('ALREADY_CLAIMED');
      }

      if (isPaid && passTier !== 'PAID') {
        throw new Error('PAID_PASS_NOT_UNLOCKED');
      }

      const reward = isPaid ? tierObj.paidReward : tierObj.freeReward;

      // Grant reward
      if (reward.type === 'stardust') {
        await client.query(
          `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
          [reward.amount, userId]
        );
      } else if (reward.type === 'cosmetic') {
        await client.query(
          `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, 'season_pass') ON CONFLICT DO NOTHING`,
          [userId, reward.id]
        );
      }

      // Mark claimed
      rewardsClaimed[claimKey] = true;
      await client.query(
        `UPDATE season_scores SET rewards_claimed = $1 WHERE season_id = $2 AND user_id = $3`,
        [JSON.stringify(rewardsClaimed), season.id, userId]
      );

      return { reward, rewardsClaimed };
    });

    res.json({ success: true, reward: result.reward, rewardsClaimed: result.rewardsClaimed });
  } catch (err: any) {
    console.error('Error claiming season reward:', err);
    res.status(400).json({ success: false, error: err.message || 'Failed to claim reward' });
  }
});

/**
 * POST /api/seasons/upgrade
 * Unlock paid season pass tier for Telegram Stars
 */
router.post('/seasons/upgrade', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: 'Database inactive' });
  }

  try {
    const season = await getActiveSeason();
    if (!season) {
      return res.status(404).json({ success: false, error: 'No active season' });
    }

    const catalogItem = getStarsCatalogItem('season_pass_paid');
    if (!catalogItem) {
      return res.status(400).json({ success: false, error: 'Season pass item not found in catalog' });
    }

    const paymentId = crypto.randomUUID();

    await query(
      `INSERT INTO payments (id, user_id, item_id, stars_amount, status, created_at)
       VALUES ($1, $2, $3, $4, 'created', NOW())`,
      [paymentId, userId, catalogItem.id, catalogItem.priceStars]
    );

    if (!config.botToken) {
      return res.status(400).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' });
    }

    const payload = JSON.stringify({ paymentId, userId, itemId: catalogItem.id });
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
      return res.status(400).json({ success: false, error: tgData.description || 'TELEGRAM_INVOICE_ERROR' });
    }

    res.json({
      success: true,
      invoiceUrl: tgData.result,
      paymentId,
    });
  } catch (err: any) {
    console.error('Error creating season pass invoice:', err);
    res.status(500).json({ success: false, error: err.message || 'Upgrade failed' });
  }
});

/**
 * GET /api/seasons/archive
 * Returns list of past archived seasons
 */
router.get('/seasons/archive', requireAuth, async (_req: Request, res: Response) => {
  if (!isDbActive()) {
    return res.status(503).json({ success: false, error: 'Database inactive' });
  }

  try {
    const resList = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, rewards FROM seasons WHERE archived = TRUE ORDER BY ends_at DESC`
    );
    res.json({ success: true, archivedSeasons: resList.rows });
  } catch (err) {
    console.error('Error fetching archived seasons:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
