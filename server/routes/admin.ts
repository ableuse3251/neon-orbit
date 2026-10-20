import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { query, isDbActive } from '../db.js';
import { config } from '../config.js';
import { logAdminAction } from '../services/audit.js';
import { refundPayment } from './stars.js';
import { bot } from '../../bot.js';
import { updateLiveConfigSchema, broadcastMessageSchema, refundPaymentSchema, adminPlayerActionSchema } from '../validators.js';

const router = Router();

// Default Live Event Config Fallback
const DEFAULT_EVENT_CONFIG = {
  id: 'season_1',
  titleEn: 'Season 1: Neon Storm',
  titleRu: 'Сезон 1: Неоновый Шторм',
  bannerSubtitleEn: 'Earn double score during active Golden Hour Surge!',
  bannerSubtitleRu: 'Получайте x2 очков во время Золотого Часа!',
  eventType: 'golden_hour',
  badgeLabel: 'LIVE EVENT',
  bannerColor: '#00F5D4',
  isGoldenHourActive: true,
  goldenHourMultiplier: 2,
  endDateISO: '2026-12-31T23:59:59Z',
};

/**
 * GET /api/config
 * Public route to fetch current Live Event configuration
 */
router.get('/config', async (req: Request, res: Response) => {
  if (isDbActive()) {
    try {
      const cfgRes = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (cfgRes.rows.length > 0) {
        return res.json({ config: cfgRes.rows[0].value });
      }
    } catch (err) {
      console.error('Error reading app_config from DB:', err);
    }
  }

  return res.json({ config: DEFAULT_EVENT_CONFIG });
});

// All routes under /api/admin require authentication AND admin privileges
router.use('/admin', requireAuth, requireAdmin);

/**
 * GET /api/admin/metrics
 * Returns comprehensive analytics metrics: DAU, WAU, D1/D7/D30 retention, avg rounds, first tap rate, K-factor, conversion, ARPDAU, funnel
 */
router.get('/admin/metrics', async (req: Request, res: Response) => {
  let dau: number | 'unavailable' = 'unavailable';
  let wau: number | 'unavailable' = 'unavailable';
  let retentionD1: number | 'unavailable' = 'unavailable';
  let retentionD7: number | 'unavailable' = 'unavailable';
  let retentionD30: number | 'unavailable' = 'unavailable';
  let kFactor: number | 'unavailable' = 'unavailable';
  let totalStarsRevenue: number = 0;
  let totalRoundsPlayed: number = 0;
  let avgRoundsPerSession: number | 'unavailable' = 'unavailable';
  let firstTapWithin5sRate: number | 'unavailable' = 'unavailable';
  let conversionToPaying: number | 'unavailable' = 'unavailable';
  let arpdau: number | 'unavailable' = 'unavailable';
  let flaggedAutoclickersCount: number = 0;
  let isDataAvailable = false;
  let funnel: {
    appOpen: number | 'unavailable';
    firstTap: number | 'unavailable';
    firstRound: number | 'unavailable';
    secondRound: number | 'unavailable';
    inviteSent: number | 'unavailable';
  } = {
    appOpen: 'unavailable',
    firstTap: 'unavailable',
    firstRound: 'unavailable',
    secondRound: 'unavailable',
    inviteSent: 'unavailable',
  };

  if (isDbActive()) {
    try {
      const checkRes = await query(`SELECT (SELECT COUNT(*) FROM users) as user_count, (SELECT COUNT(*) FROM events) as event_count`);
      const userCount = Number(checkRes.rows[0]?.user_count || 0);
      const eventCount = Number(checkRes.rows[0]?.event_count || 0);
      isDataAvailable = userCount > 0 || eventCount > 0;

      if (!isDataAvailable) {
        return res.json({
          status: 'ok',
          message: 'Analytics data source is initialized',
          metrics: {
            dau: 0,
            wau: 0,
            retentionD1: 0,
            retentionD7: 0,
            retentionD30: 0,
            kFactor: 0,
            totalStarsRevenue: 0,
            totalRoundsPlayed: 0,
            avgRoundsPerSession: 0,
            firstTapWithin5sRate: 0,
            conversionToPaying: 0,
            arpdau: 0,
            flaggedAutoclickersCount: 0,
            funnel: {
              appOpen: 0,
              firstTap: 0,
              firstRound: 0,
              secondRound: 0,
              inviteSent: 0,
            },
          },
        });
      }

      // 1. DAU & WAU (users table has primary key 'id')
      const dauRes = await query(`SELECT COUNT(DISTINCT id) as cnt FROM users WHERE last_seen_at >= CURRENT_DATE`);
      dau = dauRes.rows[0]?.cnt !== null ? Number(dauRes.rows[0].cnt) : 0;

      const wauRes = await query(`SELECT COUNT(DISTINCT id) as cnt FROM users WHERE last_seen_at >= NOW() - INTERVAL '7 days'`);
      wau = wauRes.rows[0]?.cnt !== null ? Number(wauRes.rows[0].cnt) : 0;

      // 2. Retention D1, D7, D30
      const retRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '2 days' AND last_seen_at >= NOW() - INTERVAL '1 day' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '2 days' THEN id END), 0) as d1,
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '8 days' AND last_seen_at >= NOW() - INTERVAL '7 days' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '8 days' THEN id END), 0) as d7,
          COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '31 days' AND last_seen_at >= NOW() - INTERVAL '30 days' THEN id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN created_at >= NOW() - INTERVAL '31 days' THEN id END), 0) as d30
        FROM users
      `);
      retentionD1 = (retRes.rows[0]?.d1 !== null && !isNaN(Number(retRes.rows[0].d1))) ? Math.round(Number(retRes.rows[0].d1) * 10) / 10 : 0;
      retentionD7 = (retRes.rows[0]?.d7 !== null && !isNaN(Number(retRes.rows[0].d7))) ? Math.round(Number(retRes.rows[0].d7) * 10) / 10 : 0;
      retentionD30 = (retRes.rows[0]?.d30 !== null && !isNaN(Number(retRes.rows[0].d30))) ? Math.round(Number(retRes.rows[0].d30) * 10) / 10 : 0;

      // 3. K-Factor & Conversion
      const kRes = await query(`
        SELECT 
          (SELECT COUNT(*) FROM referrals_v2 WHERE status = 'active') * 1.0 / NULLIF((SELECT COUNT(*) FROM users), 0) as k_factor
      `);
      kFactor = (kRes.rows[0]?.k_factor !== null && !isNaN(Number(kRes.rows[0].k_factor))) ? Math.round(Number(kRes.rows[0].k_factor) * 100) / 100 : 0;

      const payingRes = await query(`
        SELECT 
          (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'paid') * 100.0 / NULLIF((SELECT COUNT(*) FROM users), 0) as conversion,
          SUM(stars_amount) as total_rev
        FROM payments WHERE status = 'paid'
      `);
      conversionToPaying = (payingRes.rows[0]?.conversion !== null && !isNaN(Number(payingRes.rows[0].conversion))) ? Math.round(Number(payingRes.rows[0].conversion) * 10) / 10 : 0;
      totalStarsRevenue = Number(payingRes.rows[0]?.total_rev || 0);

      if (typeof dau === 'number' && dau > 0) {
        arpdau = Math.round((totalStarsRevenue / dau) * 100) / 100;
      } else {
        arpdau = 0;
      }

      // 4. Rounds & Sessions
      const roundsRes = await query(`SELECT COUNT(*) as cnt FROM rounds WHERE status = 'submitted'`);
      totalRoundsPlayed = Number(roundsRes.rows[0]?.cnt || 0);

      const avgRoundsRes = await query(`
        SELECT AVG(cnt) as avg_rounds FROM (
          SELECT user_id, COUNT(*) as cnt FROM rounds WHERE status = 'submitted' GROUP BY user_id
        ) t
      `);
      avgRoundsPerSession = (avgRoundsRes.rows[0]?.avg_rounds !== null && !isNaN(Number(avgRoundsRes.rows[0].avg_rounds))) ? Math.round(Number(avgRoundsRes.rows[0].avg_rounds) * 10) / 10 : 0;

      // 5. First tap within 5s rate from events (no fallback)
      const tapRateRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN name = 'first_tap' THEN user_id END) * 100.0 /
          NULLIF(COUNT(DISTINCT CASE WHEN name = 'app_open' THEN user_id END), 0) as rate
        FROM events
      `);
      firstTapWithin5sRate = (tapRateRes.rows[0]?.rate !== null && !isNaN(Number(tapRateRes.rows[0].rate))) ? Math.round(Number(tapRateRes.rows[0].rate) * 10) / 10 : 0;

      // 6. Suspicious / Shadow-Banned Autoclickers Count
      const flagRes = await query(`SELECT COUNT(*) as cnt FROM users WHERE shadow_banned = true OR is_banned = true`);
      flaggedAutoclickersCount = Number(flagRes.rows[0]?.cnt || 0);

      // 7. Onboarding Funnel counts from events and core tables
      const funnelRes = await query(`
        SELECT 
          COUNT(DISTINCT CASE WHEN name = 'app_open' THEN user_id END) as app_open,
          COUNT(DISTINCT CASE WHEN name = 'first_tap' THEN user_id END) as first_tap,
          COUNT(DISTINCT CASE WHEN name IN ('round_start', 'round_complete') THEN user_id END) as first_round,
          COUNT(DISTINCT CASE WHEN name = 'invite_sent' THEN user_id END) as invite_sent
        FROM events
      `);
      
      const fRow = funnelRes.rows[0];
      const evAppOpen = Number(fRow?.app_open || 0);
      const evFirstTap = Number(fRow?.first_tap || 0);
      const evFirstRound = Number(fRow?.first_round || 0);
      const evInviteSent = Number(fRow?.invite_sent || 0);

      const roundsCountRes = await query(`
        SELECT 
          COUNT(DISTINCT user_id) as users_with_rounds,
          COUNT(DISTINCT CASE WHEN round_cnt >= 2 THEN user_id END) as users_with_2_rounds
        FROM (
          SELECT user_id, COUNT(*) as round_cnt FROM rounds GROUP BY user_id
        ) r
      `);
      const usersWithRounds = Number(roundsCountRes.rows[0]?.users_with_rounds || 0);
      const usersWith2Rounds = Number(roundsCountRes.rows[0]?.users_with_2_rounds || 0);

      funnel.appOpen = Math.max(evAppOpen, userCount);
      funnel.firstTap = Math.max(evFirstTap, usersWithRounds > 0 ? usersWithRounds : (userCount > 0 ? 1 : 0));
      funnel.firstRound = Math.max(evFirstRound, usersWithRounds);
      funnel.secondRound = usersWith2Rounds;
      funnel.inviteSent = evInviteSent;
    } catch (err) {
      console.error('Error calculating admin metrics:', err);
      return res.status(500).json({ status: 'error', error: 'Failed to calculate metrics' });
    }
  } else {
    return res.json({
      status: 'unavailable',
      message: 'Database inactive',
      metrics: {
        dau: 'unavailable',
        wau: 'unavailable',
        retentionD1: 'unavailable',
        retentionD7: 'unavailable',
        retentionD30: 'unavailable',
        kFactor: 'unavailable',
        totalStarsRevenue: 0,
        totalRoundsPlayed: 0,
        avgRoundsPerSession: 'unavailable',
        firstTapWithin5sRate: 'unavailable',
        conversionToPaying: 'unavailable',
        arpdau: 'unavailable',
        flaggedAutoclickersCount: 0,
        funnel: {
          appOpen: 'unavailable',
          firstTap: 'unavailable',
          firstRound: 'unavailable',
          secondRound: 'unavailable',
          inviteSent: 'unavailable',
        },
      },
    });
  }

  return res.json({
    status: 'ok',
    metrics: {
      dau,
      wau,
      retentionD1,
      retentionD7,
      retentionD30,
      kFactor,
      totalStarsRevenue,
      totalRoundsPlayed,
      avgRoundsPerSession,
      firstTapWithin5sRate,
      conversionToPaying,
      arpdau,
      flaggedAutoclickersCount,
      funnel,
    },
  });
});

/**
 * GET /api/admin/players
 * List players with optional search term
 */
router.get('/admin/players', async (req: Request, res: Response) => {
  const search = String(req.query.search || '').trim();

  let players: any[] = [];

  if (isDbActive()) {
    try {
      const dbRes = await query(
        `SELECT 
           u.id,
           u.username,
           u.first_name,
           u.is_banned,
           u.shadow_banned,
           u.last_seen_at,
           COALESCE(w.level, 1) as level,
           COALESCE(w.stardust, 0) as stardust,
           COALESCE(MAX(r.score), 0) as high_score,
           COUNT(r.id) filter (where r.status = 'submitted') as total_rounds,
           COALESCE(ROUND(MAX(r.taps / GREATEST(r.duration_ms / 1000.0, 1.0))::numeric, 1), 0) as max_cps
         FROM users u
         LEFT JOIN wallets w ON u.id = w.user_id
         LEFT JOIN rounds r ON u.id = r.user_id
         WHERE ($1 = '' OR u.username ILIKE '%' || $1 || '%' OR u.first_name ILIKE '%' || $1 || '%' OR CAST(u.id AS TEXT) ILIKE '%' || $1 || '%')
         GROUP BY u.id, u.username, u.first_name, u.is_banned, u.shadow_banned, u.last_seen_at, w.level, w.stardust
         ORDER BY u.last_seen_at DESC
         LIMIT 100`,
        [search]
      );

      players = dbRes.rows.map((r: any) => ({
        id: String(r.id),
        username: r.username || 'unknown',
        firstName: r.first_name || 'Pilot',
        highScore: Number(r.high_score),
        level: Number(r.level),
        maxCps: Number(r.max_cps),
        isShadowBanned: !!r.shadow_banned,
        isBanned: !!r.is_banned,
        totalRounds: Number(r.total_rounds),
        stardust: Number(r.stardust),
        lastActiveISO: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : 'Unknown',
      }));
    } catch (err) {
      console.error('Error querying admin players:', err);
    }
  }

  return res.json({ players });
});

/**
 * POST /api/admin/players/action
 * Perform action on player (ban, unban, shadow_ban, unshadow_ban, reset_score)
 */
router.post('/admin/players/action', async (req: Request, res: Response) => {
  const parsed = adminPlayerActionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const adminUser = req.user!;
  const { userId, action } = parsed.data;

  if (isDbActive()) {
    try {
      if (action === 'ban') {
        await query(`UPDATE users SET is_banned = true WHERE id = $1`, [userId]);
      } else if (action === 'unban') {
        await query(`UPDATE users SET is_banned = false WHERE id = $1`, [userId]);
      } else if (action === 'shadow_ban') {
        await query(`UPDATE users SET shadow_banned = true WHERE id = $1`, [userId]);
      } else if (action === 'unshadow_ban') {
        await query(`UPDATE users SET shadow_banned = false WHERE id = $1`, [userId]);
      } else if (action === 'reset_score') {
        await query(`UPDATE rounds SET status = 'rejected', flags = '{"reason":"admin_reset"}' WHERE user_id = $1`, [userId]);
      }

      // Log into audit_log
      await logAdminAction(adminUser.id, `player_${action}`, String(userId), { body: req.body });

      return res.json({ success: true, userId, action });
    } catch (err) {
      console.error('Error performing player admin action:', err);
      return res.status(500).json({ error: 'Failed to perform action' });
    }
  }

  return res.json({ success: true, userId, action });
});

/**
 * GET /api/admin/payments
 * List payment records from database
 */
router.get('/admin/payments', async (req: Request, res: Response) => {
  let payments: any[] = [];

  if (isDbActive()) {
    try {
      const pRes = await query(`
        SELECT 
          p.id,
          p.user_id,
          COALESCE(u.username, u.first_name, 'Pilot') as username,
          p.item_id,
          p.stars_amount,
          p.telegram_payment_charge_id,
          p.status,
          p.created_at
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 100
      `);

      payments = pRes.rows.map((r: any) => ({
        id: String(r.id),
        userId: String(r.user_id),
        username: r.username,
        itemId: r.item_id,
        amountStars: Number(r.stars_amount),
        chargeId: r.telegram_payment_charge_id || 'N/A',
        status: r.status === 'paid' ? 'COMPLETED' : r.status === 'refunded' ? 'REFUNDED' : 'CREATED',
        timestampISO: r.created_at ? new Date(r.created_at).toISOString() : 'Unknown',
      }));
    } catch (err) {
      console.error('Error fetching admin payments:', err);
    }
  }

  return res.json({ payments });
});

/**
 * POST /api/admin/payments/refund
 * Issue refund for payment charge ID with strict provider verification (NE-28)
 */
router.post('/admin/payments/refund', async (req: Request, res: Response) => {
  const parsed = refundPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const adminUser = req.user!;
  const { chargeId } = parsed.data;

  if (isDbActive()) {
    try {
      // Find payment
      const pRes = await query(`SELECT id, user_id, telegram_payment_charge_id, status FROM payments WHERE telegram_payment_charge_id = $1 OR id = $2`, [chargeId, chargeId]);
      if (pRes.rows.length === 0) {
        return res.status(404).json({ error: 'Payment record not found' });
      }

      const pRow = pRes.rows[0];
      const targetUserId = pRow.user_id;
      const targetChargeId = pRow.telegram_payment_charge_id;

      if (pRow.status === 'refunded') {
        return res.json({ success: true, message: 'Payment already refunded (idempotent)', result: { success: true } });
      }

      if (!targetChargeId) {
        return res.status(400).json({ error: 'Payment has no Telegram charge ID associated with it. Cannot refund via provider.' });
      }

      if (!bot?.api) {
        return res.status(503).json({ error: 'Telegram bot API unavailable' });
      }

      // 1. Call provider (Telegram) first. If provider refuses or fails, DO NOT proceed with local reconciliation.
      try {
        await bot.api.refundStarPayment(Number(targetUserId), targetChargeId);
      } catch (providerErr: any) {
        console.error('Telegram provider refund refusal/error:', providerErr);
        return res.status(400).json({
          error: 'TELEGRAM_PROVIDER_REFUND_REFUSED',
          message: providerErr?.message || 'Telegram provider rejected the refund request.',
        });
      }

      // 2. Provider confirmed successfully, now reconcile locally
      const result = await refundPayment(targetUserId, targetChargeId);
      if (!result.success) {
        return res.status(500).json({ error: 'PROVIDER_CONFIRMED_LOCAL_RECONCILIATION_FAILED', details: result.error });
      }

      await logAdminAction(adminUser.id, 'refund_payment', String(pRow.id), { chargeId: targetChargeId, userId: targetUserId, result });

      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Error issuing admin refund:', err);
      return res.status(500).json({ error: err.message || 'Failed to issue refund' });
    }
  }

  return res.json({ success: true });
});

/**
 * GET /api/admin/config
 */
router.get('/admin/config', async (req: Request, res: Response) => {
  if (isDbActive()) {
    try {
      const cfgRes = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (cfgRes.rows.length > 0) {
        return res.json({ config: cfgRes.rows[0].value });
      }
    } catch (err) {
      console.error('Error fetching admin live event config:', err);
    }
  }

  if (config.mockModeAllowed) {
    return res.json({ config: DEFAULT_EVENT_CONFIG });
  }

  return res.status(503).json({ error: 'Configuration unavailable' });
});

/**
 * POST /api/admin/config
 * Save Live Ops Config in database
 */
router.post('/admin/config', async (req: Request, res: Response) => {
  const parsed = updateLiveConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const adminUser = req.user!;
  const newConfig = parsed.data.config;

  if (isDbActive()) {
    try {
      await query(
        `INSERT INTO app_config (key, value, updated_at, updated_by)
         VALUES ('live_event', $1, NOW(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(newConfig), adminUser.id]
      );

      await logAdminAction(adminUser.id, 'update_config', 'live_event', { newConfig });
      return res.json({ success: true, config: newConfig });
    } catch (err) {
      console.error('Error saving app_config to DB:', err);
      return res.status(500).json({ error: 'Failed to save app_config' });
    }
  }

  return res.json({ success: true, config: newConfig });
});

/**
 * POST /api/admin/broadcast
 * Send broadcast message to players with rate limit (~25 msgs/sec)
 */
router.post('/admin/broadcast', async (req: Request, res: Response) => {
  const parsed = broadcastMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const adminUser = req.user!;
  const { message } = parsed.data;

  let totalSent = 0;
  let totalFailed = 0;

  if (isDbActive()) {
    try {
      const usersRes = await query(`SELECT id FROM users`);
      const userIds = usersRes.rows.map((r: any) => Number(r.id));

      for (const recipientId of userIds) {
        if (bot?.api) {
          try {
            await bot.api.sendMessage(recipientId, message, { parse_mode: 'Markdown' });
            totalSent++;
          } catch (sendErr) {
            totalFailed++;
          }
          // Delay 40ms to maintain ~25 messages/sec rate limit
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
      }

      await logAdminAction(adminUser.id, 'broadcast', undefined, { message, totalSent, totalFailed });
    } catch (err) {
      console.error('Error sending broadcast:', err);
      return res.status(500).json({ error: 'Failed to send broadcast' });
    }
  }

  return res.json({ success: true, totalSent, totalFailed });
});

export default router;
