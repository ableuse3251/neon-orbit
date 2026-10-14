import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, transaction, isDbActive, pool } from '../db.js';
import { config } from '../config.js';
import { COSMETIC_ITEMS } from '../../src/shared/cosmetics.js';
import { ACHIEVEMENTS_LIST } from '../../src/shared/achievements.js';
import { REFERRAL_TIERS } from '../../src/shared/referrals.js';
import {
  buyCosmeticSchema,
  equipCosmeticSchema,
  claimAchievementSchema,
  claimReferralTierSchema,
} from '../validators.js';

const router = Router();

// Fallback in-memory tracking for development / mock mode
export const mockDailyClaims = new Map<number, { lastClaimDate: string; streak: number }>();

export function getMockDailyClaim(userId: number) {
  return mockDailyClaims.get(userId);
}

export function setMockDailyClaim(userId: number, claim: { lastClaimDate: string; streak: number }) {
  mockDailyClaims.set(userId, claim);
}

export function clearMockDailyClaims() {
  mockDailyClaims.clear();
}

function getNextUtcReset() {
  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  const msUntilReset = Math.max(0, nextReset.getTime() - now.getTime());
  return { nextResetAt: nextReset.toISOString(), msUntilReset };
}

/**
 * GET /api/daily/claim/status
 * Check if the daily streak reward has been claimed today (UTC day)
 */
router.get('/daily/claim/status', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const today = new Date().toISOString().split('T')[0];
  const { nextResetAt, msUntilReset } = getNextUtcReset();

  if (isDbActive() && pool) {
    try {
      const todayCheck = await query(
        'SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 AND claim_date = $2',
        [userId, today]
      );
      const lastClaim = await query(
        'SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1',
        [userId]
      );
      const claimedToday = todayCheck.rows.length > 0;
      const currentStreak = Number(lastClaim.rows[0]?.streak || (claimedToday ? 1 : 0));
      return res.json({
        success: true,
        claimedToday,
        canClaim: !claimedToday,
        streak: currentStreak,
        lastClaimDate: lastClaim.rows[0]?.claim_date
          ? (typeof lastClaim.rows[0].claim_date === 'string'
              ? lastClaim.rows[0].claim_date.split('T')[0]
              : new Date(lastClaim.rows[0].claim_date).toISOString().split('T')[0])
          : null,
        nextResetAt,
        msUntilReset,
      });
    } catch (err: any) {
      console.error('Error fetching daily claim status:', err);
      return res.status(500).json({ error: 'Failed to fetch daily claim status' });
    }
  }

  // Fallback / mock mode
  const mockClaim = mockDailyClaims.get(userId);
  const claimedToday = mockClaim?.lastClaimDate === today;
  return res.json({
    success: true,
    claimedToday,
    canClaim: !claimedToday,
    streak: mockClaim?.streak || 0,
    lastClaimDate: mockClaim?.lastClaimDate || null,
    nextResetAt,
    msUntilReset,
  });
});

/**
 * POST /api/daily/claim
 * Claim daily streak login reward (strictly 1 claim per UTC calendar day)
 */
router.post('/daily/claim', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterday = yesterdayDate.toISOString().split('T')[0];
  const { nextResetAt, msUntilReset } = getNextUtcReset();

  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        // Lock user row for streak insurance check
        const uRes = await client.query(
          'SELECT has_streak_insurance FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        const hasInsurance = uRes.rows[0]?.has_streak_insurance || false;

        // Check if already claimed today
        const todayCheck = await client.query(
          'SELECT 1 FROM daily_claims WHERE user_id = $1 AND claim_date = $2 FOR UPDATE',
          [userId, today]
        );
        if (todayCheck.rows.length > 0) {
          throw new Error('ALREADY_CLAIMED');
        }

        // Get latest claim
        const lastRes = await client.query(
          'SELECT claim_date, streak FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1 FOR UPDATE',
          [userId]
        );

        let newStreak = 1;
        let consumedInsurance = false;

        if (lastRes.rows.length > 0) {
          const rawLast = lastRes.rows[0].claim_date;
          const lastClaimDate = typeof rawLast === 'string'
            ? rawLast.split('T')[0]
            : new Date(rawLast).toISOString().split('T')[0];
          const lastStreak = Number(lastRes.rows[0].streak) || 1;

          if (lastClaimDate === yesterday) {
            newStreak = lastStreak + 1;
          } else if (lastClaimDate < yesterday) {
            if (hasInsurance) {
              newStreak = lastStreak + 1;
              consumedInsurance = true;
            } else {
              newStreak = 1;
            }
          }
        }

        if (newStreak > 30) newStreak = 30;

        // Calculate stardust reward
        let rewardStardust = 20 + newStreak * 10;
        if (newStreak % 5 === 0) rewardStardust += 150;
        if (newStreak === 30) rewardStardust = 2000;

        // Insert claim
        await client.query(
          'INSERT INTO daily_claims (user_id, claim_date, streak) VALUES ($1, $2, $3)',
          [userId, today, newStreak]
        );

        // Update wallet
        await client.query(
          'UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2',
          [rewardStardust, userId]
        );

        if (consumedInsurance) {
          await client.query(
            'UPDATE users SET has_streak_insurance = FALSE WHERE id = $1',
            [userId]
          );
        }

        return {
          streak: newStreak,
          rewardStardust,
          hasStreakInsurance: hasInsurance && !consumedInsurance,
          claimedToday: true,
          canClaim: false,
          lastClaimDate: today,
          nextResetAt,
          msUntilReset,
        };
      });

      return res.json({ success: true, ...result });
    } catch (err: any) {
      if (err.message === 'ALREADY_CLAIMED' || err.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'ALREADY_CLAIMED',
          message: 'Daily reward already claimed today.',
          claimedToday: true,
          canClaim: false,
          nextResetAt,
          msUntilReset,
        });
      }
      console.error('Error claiming daily reward:', err);
      return res.status(500).json({ error: 'Failed to claim daily reward.' });
    }
  } else {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }

    // In-memory tracking in mock/dev mode: strictly prevent claiming more than once per day
    const mockClaim = mockDailyClaims.get(userId);
    if (mockClaim && mockClaim.lastClaimDate === today) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_CLAIMED',
        message: 'Daily reward already claimed today.',
        claimedToday: true,
        canClaim: false,
        streak: mockClaim.streak,
        nextResetAt,
        msUntilReset,
      });
    }

    let newStreak = 1;
    if (mockClaim) {
      if (mockClaim.lastClaimDate === yesterday) {
        newStreak = Math.min(30, mockClaim.streak + 1);
      } else {
        newStreak = 1;
      }
    }

    let rewardStardust = 20 + newStreak * 10;
    if (newStreak % 5 === 0) rewardStardust += 150;
    if (newStreak === 30) rewardStardust = 2000;

    mockDailyClaims.set(userId, { lastClaimDate: today, streak: newStreak });

    return res.json({
      success: true,
      streak: newStreak,
      rewardStardust,
      hasStreakInsurance: false,
      claimedToday: true,
      canClaim: false,
      lastClaimDate: today,
      nextResetAt,
      msUntilReset,
    });
  }
});

/**
 * POST /api/achievements/claim
 * Claim achievement reward (verified on server)
 */
router.post('/achievements/claim', requireAuth, async (req: Request, res: Response) => {
  const parsed = claimAchievementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { achievementId } = parsed.data;
  const userId = req.user!.id;

  const achievement = ACHIEVEMENTS_LIST.find((a) => a.id === achievementId);
  if (!achievement) {
    return res.status(400).json({ error: 'Invalid achievement ID' });
  }

  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        // Check if already claimed
        const check = await client.query(
          'SELECT 1 FROM achievements WHERE user_id = $1 AND achievement_id = $2 FOR UPDATE',
          [userId, achievementId]
        );
        if (check.rows.length > 0) {
          throw new Error('ALREADY_CLAIMED');
        }

        // Verify criteria in DB
        const rRes = await client.query(
          `SELECT COALESCE(MAX(score), 0) as max_score, 
                  COUNT(*) as total_rounds, 
                  COALESCE(MAX(max_combo), 0) as max_combo 
           FROM rounds WHERE user_id = $1 AND status = 'submitted'`,
          [userId]
        );
        const stats = rRes.rows[0];

        const dRes = await client.query(
          'SELECT COALESCE(MAX(streak), 0) as max_streak FROM daily_claims WHERE user_id = $1',
          [userId]
        );
        const maxStreak = Number(dRes.rows[0]?.max_streak || 0);

        let eligible = false;
        const target = achievement.targetValue;
        switch (achievement.id) {
          case 'first_blood':
          case 'rounds_5':
          case 'rounds_20':
          case 'rounds_50':
            eligible = Number(stats.total_rounds) >= target;
            break;
          case 'score_5k':
          case 'score_10k':
          case 'score_15k':
            eligible = Number(stats.max_score) >= target;
            break;
          case 'combo_5':
          case 'combo_12':
          case 'combo_20':
            eligible = Number(stats.max_combo) >= target;
            break;
          case 'streak_3':
          case 'streak_7':
          case 'streak_14':
          case 'streak_30':
            eligible = maxStreak >= target;
            break;
          default:
            eligible = Number(stats.total_rounds) >= 1;
            break;
        }

        if (!eligible) {
          throw new Error('CONDITION_NOT_MET');
        }

        // Record achievement claim
        await client.query(
          'INSERT INTO achievements (user_id, achievement_id) VALUES ($1, $2)',
          [userId, achievementId]
        );

        // Add rewards to wallet
        await client.query(
          'UPDATE wallets SET stardust = stardust + $1, xp = xp + $2 WHERE user_id = $3',
          [achievement.rewardStardust, achievement.rewardXp, userId]
        );

        return { rewardStardust: achievement.rewardStardust, rewardXp: achievement.rewardXp };
      });

      return res.json({ success: true, achievementId, ...result });
    } catch (err: any) {
      if (err.message === 'ALREADY_CLAIMED' || err.code === '23505') {
        return res.status(400).json({ error: 'Achievement already claimed.' });
      }
      if (err.message === 'CONDITION_NOT_MET') {
        return res.status(400).json({ error: 'Achievement condition not fulfilled.' });
      }
      console.error('Error claiming achievement:', err);
      return res.status(500).json({ error: 'Failed to claim achievement.' });
    }
  } else {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }
    return res.json({
      success: true,
      achievementId,
      rewardStardust: achievement.rewardStardust,
      rewardXp: achievement.rewardXp,
    });
  }
});

/**
 * POST /api/shop/buy
 * Buy cosmetic item for Stardust (transactional with balance check)
 */
router.post('/shop/buy', requireAuth, async (req: Request, res: Response) => {
  const parsed = buyCosmeticSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { itemId } = parsed.data;
  const userId = req.user!.id;

  const item = COSMETIC_ITEMS.find((c) => c.id === itemId);
  if (!item) {
    return res.status(400).json({ error: 'Item not found in catalog' });
  }

  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        // 1. Check if item is already owned
        const invCheck = await client.query(
          'SELECT 1 FROM inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE',
          [userId, itemId]
        );
        if (invCheck.rows.length > 0) {
          throw new Error('ALREADY_OWNED');
        }

        // 2. Lock wallet and check balance
        const wRes = await client.query(
          'SELECT stardust FROM wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );
        const currentStardust = Number(wRes.rows[0]?.stardust || 0);

        if (currentStardust < item.priceStardust) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        // 3. Atomic deduction with constraint check
        const updateRes = await client.query(
          'UPDATE wallets SET stardust = stardust - $1 WHERE user_id = $2 AND stardust >= $1 RETURNING stardust',
          [item.priceStardust, userId]
        );

        if (updateRes.rows.length === 0) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        // 4. Insert into inventory
        await client.query(
          'INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, \'shop\')',
          [userId, itemId]
        );

        return { remainingStardust: Number(updateRes.rows[0].stardust) };
      });

      return res.json({ success: true, itemId, remainingStardust: result.remainingStardust });
    } catch (err: any) {
      if (err.message === 'ALREADY_OWNED' || err.code === '23505') {
        return res.status(400).json({ error: 'Item is already owned.' });
      }
      if (err.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Insufficient Stardust balance.' });
      }
      console.error('Error buying shop item:', err);
      return res.status(500).json({ error: 'Failed to purchase item.' });
    }
  } else {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }
    return res.json({ success: true, itemId, remainingStardust: 100 });
  }
});

/**
 * POST /api/equip
 * Equip unlocked cosmetic item
 */
router.post('/equip', requireAuth, async (req: Request, res: Response) => {
  const parsed = equipCosmeticSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { category, itemId } = parsed.data;
  const userId = req.user!.id;

  const item = COSMETIC_ITEMS.find((c) => c.id === itemId && c.category === category);
  if (!item) {
    return res.status(400).json({ error: 'Item not found in catalog for this category' });
  }

  if (isDbActive() && pool) {
    try {
      // Check if unlocked (free items or present in inventory)
      if (item.priceStardust > 0) {
        const invCheck = await query(
          'SELECT 1 FROM inventory WHERE user_id = $1 AND item_id = $2',
          [userId, itemId]
        );
        if (invCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Item is not unlocked.' });
        }
      }

      await query(
        `INSERT INTO equipped (user_id, ${category}) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET ${category} = EXCLUDED.${category}`,
        [userId, itemId]
      );

      return res.json({ success: true, category, itemId });
    } catch (err) {
      console.error('Error equipping item:', err);
      return res.status(500).json({ error: 'Failed to equip item.' });
    }
  } else {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }
    return res.json({ success: true, category, itemId });
  }
});

/**
 * POST /api/referrals/claim
 * Claim referral threshold milestone reward
 */
router.post('/referrals/claim', requireAuth, async (req: Request, res: Response) => {
  const parsed = claimReferralTierSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { tierLevel } = parsed.data;
  const userId = req.user!.id;

  const tier = REFERRAL_TIERS.find((t) => t.level === tierLevel);
  if (!tier) {
    return res.status(400).json({ error: 'Invalid referral tier' });
  }

  if (isDbActive() && pool) {
    try {
      const result = await transaction(async (client) => {
        // Check if tier already claimed
        const check = await client.query(
          'SELECT 1 FROM referral_tier_claims WHERE user_id = $1 AND tier_level = $2 FOR UPDATE',
          [userId, tier.level]
        );
        if (check.rows.length > 0) {
          throw new Error('ALREADY_CLAIMED');
        }

        // Count referrals
        const refRes = await client.query(
          'SELECT COUNT(*) as count FROM referrals WHERE inviter_id = $1',
          [userId]
        );
        const totalReferrals = Number(refRes.rows[0]?.count || 0);

        if (totalReferrals < tier.requiredInvites) {
          throw new Error('NOT_ENOUGH_REFERRALS');
        }

        // Record claim
        await client.query(
          'INSERT INTO referral_tier_claims (user_id, tier_level) VALUES ($1, $2)',
          [userId, tier.level]
        );

        // Grant stardust
        await client.query(
          'UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2',
          [tier.rewardStardust, userId]
        );

        // Grant ship skin if rewarded
        if (tier.rewardShipId) {
          await client.query(
            'INSERT INTO inventory (user_id, item_id, source) VALUES ($1, $2, \'referral\') ON CONFLICT DO NOTHING',
            [userId, tier.rewardShipId]
          );
        }

        return { rewardStardust: tier.rewardStardust, rewardShipId: tier.rewardShipId };
      });

      return res.json({ success: true, tierLevel: tier.level, ...result });
    } catch (err: any) {
      if (err.message === 'ALREADY_CLAIMED' || err.code === '23505') {
        return res.status(400).json({ error: 'Referral tier already claimed.' });
      }
      if (err.message === 'NOT_ENOUGH_REFERRALS') {
        return res.status(400).json({ error: 'Insufficient referrals for this tier.' });
      }
      console.error('Error claiming referral tier:', err);
      return res.status(500).json({ error: 'Failed to claim referral tier.' });
    }
  } else {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }
    return res.json({ success: true, tierLevel: tier.level, rewardStardust: tier.rewardStardust });
  }
});

export default router;
