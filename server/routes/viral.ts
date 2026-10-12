import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, transaction, isDbActive } from '../db.js';
import { createChallenge, getChallenge, getChatLeaderboard, getUserReferrals, getTeamGoal, contributeTeamGoal } from '../services/viral.js';
import { createChallengeSchema, viralChatContributionSchema } from '../validators.js';

const router = Router();

router.post('/viral/challenge', requireAuth, async (req: Request, res: Response) => {
  const parsed = createChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  try {
    const userId = req.user!.id;
    const { score, combo, seed } = parsed.data;
    const seedVal = seed !== undefined ? String(seed) : String(Date.now());
    const challengeId = await createChallenge(userId, score, combo, Number(seedVal) || Date.now());
    res.json({ success: true, challengeId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/viral/challenge/:id', async (req: Request, res: Response) => {
  try {
    const challenge = await getChallenge(req.params.id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    res.json({ success: true, challenge });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/viral/chat/:chatId', async (req: Request, res: Response) => {
  try {
    const chatId = parseInt(req.params.chatId);
    const leaderboard = await getChatLeaderboard(chatId);
    res.json({ success: true, leaderboard });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/viral/chat', requireAuth, async (req: Request, res: Response) => {
  const parsed = viralChatContributionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  try {
    const userId = req.user!.id;
    const user = req.user!;
    const { chatId: rawChatId, roundId } = parsed.data;
    const chatId = typeof rawChatId === 'string' ? parseInt(rawChatId, 10) : rawChatId;
    if (!chatId || isNaN(chatId)) return res.status(400).json({ error: 'valid chatId required' });

    if (!isDbActive()) {
      return res.status(503).json({ error: 'Database inactive' });
    }

    const verifiedScore = await transaction(async (client) => {
      const roundRes = await client.query(
        `SELECT id, score, status, flags FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [roundId, userId]
      );

      if (roundRes.rows.length === 0) {
        throw new Error('ROUND_NOT_FOUND_OR_UNAUTHORIZED');
      }

      const round = roundRes.rows[0];
      if (round.status !== 'submitted') {
        throw new Error('ROUND_NOT_SUBMITTED');
      }

      const flags = round.flags || {};
      if (flags.viral_contributed) {
        throw new Error('ALREADY_CONTRIBUTED');
      }

      const scoreVal = Number(round.score || 0);
      if (scoreVal <= 0 || scoreVal > 1000000) {
        throw new Error('INVALID_SCORE');
      }

      // Mark round as contributed
      flags.viral_contributed = true;
      await client.query(`UPDATE rounds SET flags = $1 WHERE id = $2`, [JSON.stringify(flags), roundId]);

      // Update chat leaderboard
      await client.query(
        `INSERT INTO chat_leaderboards (chat_id, user_id, username, first_name, total_score, updated_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (chat_id, user_id) 
         DO UPDATE SET total_score = chat_leaderboards.total_score + $5, username = $3, first_name = $4, updated_at = CURRENT_TIMESTAMP`,
        [chatId, userId, user.username || 'Pilot', user.firstName || 'Captain', scoreVal]
      );

      return scoreVal;
    });

    await contributeTeamGoal(verifiedScore);
    res.json({ success: true, verifiedScore });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to contribute to chat score' });
  }
});

router.get('/viral/referrals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await getUserReferrals(userId);
    res.json({ success: true, ...data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/viral/team-goal', async (req: Request, res: Response) => {
  try {
    const goal = await getTeamGoal();
    res.json({ success: true, goal });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
