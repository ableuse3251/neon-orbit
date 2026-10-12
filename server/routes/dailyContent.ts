import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getUserDailyQuests, claimQuestReward, getActiveGoldenHour, getActiveLimitedEvents, getUserStreak } from '../services/dailyContent.js';
import { query } from '../db.js';

const router = Router();

router.get('/daily/quests', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const quests = await getUserDailyQuests(userId);
    res.json({ success: true, quests });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/daily/quests/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { questId } = req.body;
    if (!questId) return res.status(400).json({ success: false, error: 'questId required' });

    const result = await claimQuestReward(userId, questId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/daily/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const goldenHour = await getActiveGoldenHour();
    const limitedEvents = await getActiveLimitedEvents();
    const streak = await getUserStreak(userId);

    // Today's challenge
    const today = new Date().toISOString().split('T')[0];
    let challengeRes = await query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    if (challengeRes.rows.length === 0) {
      // create default today challenge seed
      const seed = 'neon_seed_' + today.replace(/-/g, '');
      await query(
        `INSERT INTO daily_challenges (challenge_date, seed, theme, modifier) VALUES ($1, $2, 'NEON_CHALLENGE', 'STANDARD') ON CONFLICT (challenge_date) DO NOTHING`,
        [today, seed]
      );
      challengeRes = await query(`SELECT * FROM daily_challenges WHERE challenge_date = $1`, [today]);
    }

    res.json({
      success: true,
      goldenHour,
      limitedEvents,
      streak,
      dailyChallenge: challengeRes.rows[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/daily/streak/protect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const streakObj = await getUserStreak(userId);
    if (streakObj.streak_freezes_left <= 0) {
      return res.status(400).json({ success: false, error: 'No streak freezes left. Invite a friend or use Stars.' });
    }

    await query(
      `UPDATE user_streaks SET streak_freezes_left = streak_freezes_left - 1, is_protected = true WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Streak protected for today!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
