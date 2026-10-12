import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, transaction, isDbActive } from '../db.js';
import { recalculateRound, ClickLog } from '../../src/shared/targetGenerator.js';
import { calculateRoundRewards, getLevelFromXp } from '../../src/utils/progression.js';
import {
  updateLeaderboardOnRoundSubmit,
  getLeaderboard,
  getRankTitle,
} from '../services/leaderboard.js';
import { startRoundSchema, submitRoundSchema } from '../validators.js';
import { config } from '../config.js';

const router = Router();

import { isGoldenHourActiveServer } from '../services/events.js';

// 1. POST /round/start & /game/round/start
const handleStartRound = async (req: Request, res: Response) => {
  const parsed = startRoundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { mode, seed: customSeed } = parsed.data;
  const user = req.user!;

  if (isDbActive()) {
    try {
      const txResult = await transaction(async (client) => {
        // Ensure user exists and lock user row to serialize concurrent round starts for this user
        await client.query(
          `INSERT INTO users (id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username || null, user.firstName || null]
        );
        await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [user.id]);

        // Check for active issued round
        const activeRoundRes = await client.query(
          `SELECT id, started_at FROM rounds WHERE user_id = $1 AND status = 'issued' ORDER BY started_at DESC LIMIT 1`,
          [user.id]
        );

        if (activeRoundRes.rows.length > 0) {
          const active = activeRoundRes.rows[0];
          const ageMs = Date.now() - new Date(active.started_at).getTime();

          if (ageMs < 40000) {
            // Less than 40s ago - user already has an active round in progress
            return {
              status: 429,
              json: {
                error: 'Round already in progress',
                activeRoundId: active.id,
              },
            };
          } else {
            // Abandoned round (>40s old), mark as rejected
            await client.query(`UPDATE rounds SET status = 'rejected', flags = '{"reason":"abandoned"}' WHERE id = $1`, [active.id]);
          }
        }

        // Generate seed
        let seed = customSeed;
        if (!seed) {
          if (mode === 'daily') {
            seed = `daily_${new Date().toISOString().split('T')[0]}`;
          } else if (mode === 'challenge') {
            seed = `challenge_${user.id}_${Date.now()}`;
          } else {
            seed = `norm_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
          }
        }

        const roundRes = await client.query(
          `INSERT INTO rounds (user_id, seed, mode, status, started_at) VALUES ($1, $2, $3, 'issued', NOW()) RETURNING id, started_at`,
          [user.id, seed, mode]
        );

        const newRound = roundRes.rows[0];
        return {
          status: 200,
          json: {
            success: true,
            roundId: newRound.id,
            seed,
            serverStartedAt: new Date(newRound.started_at).getTime(),
            mode,
          },
        };
      });

      return res.status(txResult.status).json(txResult.json);
    } catch (err) {
      console.error('Database round start error:', err);
      if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
        return res.status(503).json({ error: 'Database error starting round', message: 'Service temporarily unavailable' });
      }
    }
  }

  if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
    return res.status(503).json({
      error: 'Database unavailable in production',
      message: 'Service temporarily unavailable. Database required.',
    });
  }

  // Memory fallback for demo mode only in dev/test
  const fallbackSeed = customSeed || (mode === 'daily' ? `daily_${new Date().toISOString().split('T')[0]}` : `norm_${Date.now()}`);
  return res.json({
    success: true,
    roundId: `rnd_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    seed: fallbackSeed,
    serverStartedAt: Date.now(),
    mode,
  });
};

router.post('/round/start', requireAuth, handleStartRound);
router.post('/game/round/start', requireAuth, handleStartRound);

// 2. POST /round/submit & /game/round/submit
const handleSubmitRound = async (req: Request, res: Response) => {
  const parsed = submitRoundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const { roundId, clickLogs, chatId } = parsed.data;
  const user = req.user!;

  if (!isDbActive()) {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      return res.status(503).json({
        error: 'Database unavailable in production',
        message: 'Service temporarily unavailable. Database required.',
      });
    }
  }

  let confirmedScore = 0;
  let earnedXp = 0;
  let earnedStardust = 0;
  let newLevel = 1;
  let isLevelUp = false;
  let evalResult: any = null;
  let roundMode = 'normal';
  let isShadowBanned = false;
  let alreadySubmittedResult: any = null;

  if (isDbActive()) {
    try {
      if (!roundId || roundId.startsWith('rnd_')) {
        if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
          return res.status(400).json({
            error: 'Invalid round ID',
            message: 'Server-issued database round ID is required in production.',
          });
        }
      }

      const txResult = await transaction(async (client) => {
        // 1. Lock and fetch round
        const roundRes = await client.query(
          `SELECT id, seed, mode, status, started_at, score FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE`,
          [roundId, user.id]
        );

        if (roundRes.rows.length === 0) {
          return { status: 404, json: { error: 'Round not found or belongs to another user' } };
        }

        const dbRound = roundRes.rows[0];
        roundMode = dbRound.mode || 'normal';

        // 2. Idempotency check: if already submitted, return success idempotently without re-crediting rewards
        if (dbRound.status === 'submitted') {
          return {
            status: 200,
            json: {
              success: true,
              confirmedScore: dbRound.score || 0,
              alreadySubmitted: true,
              message: 'Round was already submitted successfully',
            },
          };
        }

        if (dbRound.status !== 'issued') {
          return { status: 400, json: { error: 'Round has already been rejected or completed' } };
        }

        // 3. Check round expiration (max 120 seconds from start)
        const ageMs = Date.now() - new Date(dbRound.started_at).getTime();
        if (ageMs > 120000) {
          await client.query(`UPDATE rounds SET status = 'rejected', flags = $1 WHERE id = $2`, [
            JSON.stringify({ reason: 'expired', ageMs }),
            dbRound.id,
          ]);
          return { status: 400, json: { error: 'Round expired', message: 'Round took too long to complete' } };
        }

        const durationMs = ageMs;

        // 4. Check user ban status with row lock
        const userRes = await client.query(`SELECT shadow_banned, is_banned FROM users WHERE id = $1 FOR UPDATE`, [user.id]);
        if (userRes.rows.length > 0) {
          if (userRes.rows[0].is_banned) {
            return { status: 403, json: { error: 'Account banned' } };
          }
          isShadowBanned = Boolean(userRes.rows[0].shadow_banned);
        }

        // 5. Recalculate round score & anti-cheat evaluation
        const effectiveSeed = dbRound.seed || `norm_${Date.now()}`;
        evalResult = recalculateRound(effectiveSeed, clickLogs, durationMs);

        if (!evalResult.isValid) {
          await client.query(
            `UPDATE rounds SET status = 'rejected', flags = $1 WHERE id = $2`,
            [JSON.stringify({ flags: evalResult.flags }), dbRound.id]
          );

          const suspicionRes = await client.query(
            `SELECT COUNT(*) as cnt FROM rounds WHERE user_id = $1 AND status = 'rejected'`,
            [user.id]
          );
          const rejectedCount = Number(suspicionRes.rows[0]?.cnt || 0);

          if (rejectedCount >= 3 && !isShadowBanned) {
            await client.query(`UPDATE users SET shadow_banned = true WHERE id = $1`, [user.id]);
            isShadowBanned = true;
          }

          if (!isShadowBanned) {
            return {
              status: 403,
              json: {
                success: false,
                rejected: true,
                flags: evalResult.flags,
                reason: 'Round failed server verification check',
              },
            };
          }
        }

        // 6. Server Golden Hour Calculation
        const eventStatus = await isGoldenHourActiveServer();
        confirmedScore = eventStatus.isActive ? evalResult.recalculatedScore * eventStatus.multiplier : evalResult.recalculatedScore;

        // 7. Calculate rewards
        const rewards = calculateRoundRewards({
          score: confirmedScore,
          accuracy: evalResult.accuracy,
          maxCombo: evalResult.maxCombo,
          goldenBeaconsHit: evalResult.goldenBeaconsHit,
        } as any);

        earnedXp = rewards.earnedXp;
        earnedStardust = rewards.earnedStardust;

        // 8. Ensure wallet and lock
        await client.query(
          `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
          [user.id]
        );

        const wRes = await client.query(`SELECT stardust, xp, level FROM wallets WHERE user_id = $1 FOR UPDATE`, [user.id]);
        let currentXp = 0;
        let currentStardust = 0;
        let currentLevel = 1;

        if (wRes.rows.length > 0) {
          currentXp = Number(wRes.rows[0].xp);
          currentStardust = Number(wRes.rows[0].stardust);
          currentLevel = Number(wRes.rows[0].level);
        }

        const totalXp = currentXp + earnedXp;
        const totalStardust = currentStardust + earnedStardust;
        const levelInfo = getLevelFromXp(totalXp);
        newLevel = levelInfo.level;
        isLevelUp = newLevel > currentLevel;

        await client.query(
          `UPDATE wallets SET xp = $1, stardust = $2, level = $3 WHERE user_id = $4`,
          [totalXp, totalStardust, newLevel, user.id]
        );

        // 9. Update round status to submitted atomically
        await client.query(
          `UPDATE rounds 
           SET finished_at = NOW(), status = 'submitted', score = $1, taps = $2, hits = $3, max_combo = $4, duration_ms = $5, flags = $6
           WHERE id = $7`,
          [
            confirmedScore,
            evalResult.totalTaps,
            evalResult.hits,
            evalResult.maxCombo,
            durationMs,
            JSON.stringify({ verified: true, goldenHour: eventStatus.isActive, multiplier: eventStatus.multiplier }),
            dbRound.id,
          ]
        );

        if (clickLogs.length > 0) {
          await client.query(`INSERT INTO round_events (round_id, payload) VALUES ($1, $2)`, [
            dbRound.id,
            JSON.stringify(clickLogs),
          ]);
        }

        return {
          status: 200,
          json: {
            success: true,
            confirmedScore,
            earnedXp,
            earnedStardust,
            level: newLevel,
            isLevelUp,
            rankTitle: getRankTitle(confirmedScore),
            flags: evalResult.flags,
          },
        };
      });

      if (txResult.status === 200 && !txResult.json.alreadySubmitted && !isShadowBanned) {
        try {
          await updateLeaderboardOnRoundSubmit(user.id, confirmedScore, roundMode, chatId);
        } catch (lbErr) {
          console.error('Leaderboard update error after reward credit:', lbErr);
        }
      }

      return res.status(txResult.status).json(txResult.json);
    } catch (err) {
      console.error('Database round submit transaction error:', err);
      return res.status(500).json({
        error: 'Transaction failed',
        message: 'Failed to process round submission and allocate rewards securely',
      });
    }
  } else {
    // Fallback mode for testing without DB
    const effectiveSeed = `norm_${Date.now()}`;
    evalResult = recalculateRound(effectiveSeed, clickLogs, 45000);
    confirmedScore = evalResult.recalculatedScore;
    const rewards = calculateRoundRewards({
      score: confirmedScore,
      accuracy: evalResult.accuracy,
      maxCombo: evalResult.maxCombo,
      goldenBeaconsHit: evalResult.goldenBeaconsHit,
    } as any);
    earnedXp = rewards.earnedXp;
    earnedStardust = rewards.earnedStardust;
    newLevel = getLevelFromXp(earnedXp).level;
    isLevelUp = newLevel > 1;

    return res.json({
      success: true,
      confirmedScore,
      earnedXp,
      earnedStardust,
      level: newLevel,
      isLevelUp,
      rankTitle: getRankTitle(confirmedScore),
      flags: evalResult.flags,
    });
  }
};

router.post('/round/submit', requireAuth, handleSubmitRound);
router.post('/game/round/submit', requireAuth, handleSubmitRound);

// 3. GET /leaderboard & /game/leaderboard
const handleGetLeaderboard = async (req: Request, res: Response) => {
  const user = req.user!;
  const rawScope = (req.query.scope || req.query.mode || 'global') as string;
  const scope = (['global', 'daily', 'friends', 'chat'].includes(rawScope)
    ? rawScope
    : 'global') as 'global' | 'daily' | 'friends' | 'chat';

  const chatId = req.query.chatId ? String(req.query.chatId) : undefined;

  const result = await getLeaderboard(scope, user.id, { chatId, lang: user.language });
  return res.json(result);
};

router.get('/leaderboard', requireAuth, handleGetLeaderboard);
router.get('/game/leaderboard', requireAuth, handleGetLeaderboard);

// 4. GET /challenge/info
router.get('/challenge/info', async (req: Request, res: Response) => {
  const challengeId = String(req.query.id || req.query.seed || '').trim();
  if (!challengeId) {
    return res.status(400).json({ error: 'Missing challenge id or seed' });
  }

  let challengerName = 'Ace Pilot';
  let challengerScore = 12400;
  let targetSeed = challengeId;

  if (isDbActive()) {
    try {
      const dbRes = await query(
        `SELECT r.seed, r.score, COALESCE(u.first_name, u.username, 'Pilot') as name
         FROM rounds r
         JOIN users u ON r.user_id = u.id
         WHERE (r.id::text = $1 OR r.seed = $1) AND r.status = 'submitted'
         ORDER BY r.score DESC LIMIT 1`,
        [challengeId]
      );
      if (dbRes.rows.length > 0) {
        targetSeed = dbRes.rows[0].seed;
        challengerScore = Number(dbRes.rows[0].score);
        challengerName = dbRes.rows[0].name;
      }
    } catch (err) {
      console.error('Error fetching challenge info:', err);
    }
  }

  return res.json({
    success: true,
    challenge: {
      id: challengeId,
      challengerName,
      challengerScore,
      targetSeed,
      expiresInSeconds: 86400,
    },
  });
});

export default router;
