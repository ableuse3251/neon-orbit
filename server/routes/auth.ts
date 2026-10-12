import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, isDbActive } from '../db.js';
import { redisZRem } from '../redis.js';
import { removeUserFromAllLeaderboards, deleteUserAccount } from '../services/leaderboard.js';

const router = Router();

router.get('/session', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  let wallet = { stardust: 150, xp: 0, level: 1 };
  let equipped = {
    ship: 'ship_cyber_wing',
    trail: 'trail_cyan_beam',
    backdrop: 'backdrop_synth_grid',
    explosion: 'exp_retro_burst',
    frame: 'frame_pilot_steel',
    theme: 'theme_classic_purple',
  };
  let inventory: string[] = ['ship_cyber_wing', 'backdrop_synth_grid'];
  let achievements: string[] = [];
  let dailyClaimStreak = { streak: 1, lastClaimDate: '' };
  let referralsCount = 0;
  let hasStreakInsurance = false;
  let hideFromLeaderboard = false;
  let notificationsEnabled = true;

  if (isDbActive()) {
    try {
      // 1. Fetch wallet
      const wRes = await query('SELECT stardust, xp, level FROM wallets WHERE user_id = $1', [user.id]);
      if (wRes.rows.length > 0) {
        wallet = {
          stardust: Number(wRes.rows[0].stardust),
          xp: Number(wRes.rows[0].xp),
          level: Number(wRes.rows[0].level),
        };
      }

      // 2. Fetch equipped
      const eqRes = await query(
        'SELECT ship, trail, backdrop, explosion, frame, theme FROM equipped WHERE user_id = $1',
        [user.id]
      );
      if (eqRes.rows.length > 0) {
        const row = eqRes.rows[0];
        equipped = {
          ship: row.ship || 'ship_cyber_wing',
          trail: row.trail || 'trail_cyan_beam',
          backdrop: row.backdrop || 'backdrop_synth_grid',
          explosion: row.explosion || 'exp_retro_burst',
          frame: row.frame || 'frame_pilot_steel',
          theme: row.theme || 'theme_classic_purple',
        };
      }

      // 3. Fetch inventory
      const invRes = await query('SELECT item_id FROM inventory WHERE user_id = $1', [user.id]);
      if (invRes.rows.length > 0) {
        inventory = invRes.rows.map((r: any) => String(r.item_id));
      }

      // 4. Fetch achievements
      const achRes = await query('SELECT achievement_id FROM achievements WHERE user_id = $1', [user.id]);
      if (achRes.rows.length > 0) {
        achievements = achRes.rows.map((r: any) => String(r.achievement_id));
      }

      // 5. Fetch daily claims
      const claimRes = await query(
        'SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1',
        [user.id]
      );
      if (claimRes.rows.length > 0) {
        dailyClaimStreak = {
          streak: Number(claimRes.rows[0].streak || 1),
          lastClaimDate: String(claimRes.rows[0].claim_date || ''),
        };
      }

      // 6. Fetch referral count
      const refRes = await query('SELECT COUNT(*) as count FROM referrals WHERE inviter_id = $1', [user.id]);
      if (refRes.rows.length > 0) {
        referralsCount = Number(refRes.rows[0].count || 0);
      }

      // 7. Fetch user streak insurance and privacy state
      const uRes = await query('SELECT has_streak_insurance, hide_from_leaderboard, notifications_enabled FROM users WHERE id = $1', [user.id]);
      if (uRes.rows.length > 0) {
        hasStreakInsurance = !!uRes.rows[0].has_streak_insurance;
        hideFromLeaderboard = !!uRes.rows[0].hide_from_leaderboard;
        notificationsEnabled = uRes.rows[0].notifications_enabled !== false;
      }
    } catch (err) {
      console.error('Error fetching session data from DB:', err);
    }
  }

  res.json({
    profile: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      language: user.language,
      isPremium: user.isPremium,
      isAdmin: user.isAdmin,
      isDemo: !!user.isDemo,
      referralCode: `ref_${user.id}`,
      referralsCount,
      hasStreakInsurance,
      hideFromLeaderboard,
      notificationsEnabled,
    },
    wallet,
    equipped,
    inventory,
    achievements,
    dailyClaimStreak,
  });
});

import { updateUserSettingsSchema } from '../validators.js';

/**
 * POST /api/user/settings
 * Update user settings (e.g., hide_from_leaderboard, notifications_enabled)
 */
router.post('/user/settings', requireAuth, async (req: Request, res: Response) => {
  const parsed = updateUserSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }

  const user = req.user!;
  const { hideFromLeaderboard, notificationsEnabled } = parsed.data;

  if (isDbActive()) {
    try {
      if (typeof hideFromLeaderboard === 'boolean') {
        await query('UPDATE users SET hide_from_leaderboard = $1 WHERE id = $2', [hideFromLeaderboard, user.id]);

        if (hideFromLeaderboard) {
          // Remove from Redis global & daily leaderboards
          const todayStr = new Date().toISOString().split('T')[0];
          await redisZRem('leaderboard:global', String(user.id));
          await redisZRem(`leaderboard:daily:${todayStr}`, String(user.id));
        }
      }

      if (typeof notificationsEnabled === 'boolean') {
        await query('UPDATE users SET notifications_enabled = $1 WHERE id = $2', [notificationsEnabled, user.id]);
      }
    } catch (err) {
      console.error('Error updating user settings in DB:', err);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }

  res.json({
    success: true,
    hideFromLeaderboard: Boolean(hideFromLeaderboard),
    notificationsEnabled: typeof notificationsEnabled === 'boolean' ? notificationsEnabled : true,
  });
});

/**
 * POST /api/user/delete-account
 * GDPR & Privacy Compliance: Permanently erase player account, stats, and records
 */
router.post('/user/delete-account', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;

  if (isDbActive()) {
    const result = await deleteUserAccount(user.id);
    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to delete account' });
    }
  }

  res.json({ success: true, message: 'Account permanently erased' });
});

export default router;
