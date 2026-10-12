import { query, transaction, isDbActive } from '../db.js';

export async function getUserDailyQuests(userId: number) {
  if (!await isDbActive()) return [];
  const today = new Date().toISOString().split('T')[0];
  
  // Ensure 3 quests are assigned for today
  await transaction(async (client) => {
    const existing = await client.query(
      `SELECT q.*, uq.progress, uq.target_value as uq_target, uq.is_completed, uq.is_claimed 
       FROM daily_quests q 
       JOIN user_daily_quests uq ON q.id = uq.quest_id 
       WHERE uq.user_id = $1 AND uq.reset_date = $2`,
      [userId, today]
    );
    
    if (existing.rows.length < 3) {
      // Pick 3 random quests
      const allQ = await client.query(`SELECT * FROM daily_quests`);
      const shuffled = allQ.rows.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      for (const q of selected) {
        await client.query(
          `INSERT INTO user_daily_quests (user_id, quest_id, progress, target_value, is_completed, is_claimed, reset_date)
           VALUES ($1, $2, 0, $3, false, false, $4)
           ON CONFLICT (user_id, quest_id, reset_date) DO NOTHING`,
          [userId, q.id, q.target_value, today]
        );
      }
    }
  });

  const res = await query(
    `SELECT q.id, q.title_en, q.title_ru, q.type, q.reward_dust, q.reward_exp,
            uq.progress, uq.target_value, uq.is_completed, uq.is_claimed
     FROM daily_quests q
     JOIN user_daily_quests uq ON q.id = uq.quest_id
     WHERE uq.user_id = $1 AND uq.reset_date = $2`,
    [userId, today]
  );
  return res.rows;
}

export async function updateQuestProgress(userId: number, type: string, amount: number = 1) {
  if (!await isDbActive()) return;
  const today = new Date().toISOString().split('T')[0];
  
  await transaction(async (client) => {
    const activeQuests = await client.query(
      `SELECT uq.*, q.target_value FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.reset_date = $2 AND q.type = $3 AND uq.is_completed = false`,
      [userId, today, type]
    );

    for (const uq of activeQuests.rows) {
      const newProgress = Math.min(uq.target_value, uq.progress + amount);
      const isCompleted = newProgress >= uq.target_value;
      await client.query(
        `UPDATE user_daily_quests SET progress = $1, is_completed = $2 WHERE id = $3`,
        [newProgress, isCompleted, uq.id]
      );
    }
  });
}

export async function claimQuestReward(userId: number, questId: string) {
  if (!await isDbActive()) return { success: false, error: 'DB inactive' };
  // Note: Daily reset is calculated based on UTC calendar day (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];

  return await transaction(async (client) => {
    const uqRes = await client.query(
      `SELECT uq.*, q.reward_dust, q.reward_exp FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.quest_id = $2 AND uq.reset_date = $3 FOR UPDATE`,
      [userId, questId, today]
    );

    if (uqRes.rows.length === 0) return { success: false, error: 'Quest not found' };
    const uq = uqRes.rows[0];

    if (!uq.is_completed) return { success: false, error: 'Quest not completed' };
    if (uq.is_claimed) return { success: false, error: 'Already claimed' };

    // Atomic conditional update to prevent race conditions or duplicate claims
    const updateRes = await client.query(
      `UPDATE user_daily_quests SET is_claimed = true WHERE id = $1 AND is_claimed = false RETURNING id`,
      [uq.id]
    );

    if (updateRes.rows.length === 0) {
      return { success: false, error: 'Already claimed' };
    }

    // Ensure canonical wallet exists
    await client.query(
      `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // Give stardust and xp to canonical wallets table (NE-21)
    await client.query(
      `UPDATE wallets SET stardust = stardust + $1, xp = xp + $2 WHERE user_id = $3`,
      [uq.reward_dust, uq.reward_exp, userId]
    );

    return { success: true, rewardStardust: uq.reward_dust, rewardXp: uq.reward_exp };
  });
}

export async function getActiveGoldenHour() {
  if (!await isDbActive()) return null;
  const res = await query(
    `SELECT * FROM golden_hours WHERE starts_at <= NOW() AND ends_at >= NOW() ORDER BY starts_at DESC LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function getActiveLimitedEvents() {
  if (!await isDbActive()) return [];
  const res = await query(
    `SELECT * FROM limited_events WHERE is_active = true AND starts_at <= NOW() AND ends_at >= NOW()`
  );
  return res.rows;
}

export async function getUserStreak(userId: number) {
  if (!await isDbActive()) return { currentStreak: 1, maxStreak: 1, streakFreezesLeft: 1 };
  const today = new Date().toISOString().split('T')[0];

  let res = await query(`SELECT * FROM user_streaks WHERE user_id = $1`, [userId]);
  if (res.rows.length === 0) {
    await query(
      `INSERT INTO user_streaks (user_id, current_streak, max_streak, last_activity_date, streak_freezes_left)
       VALUES ($1, 1, 1, $2, 1) ON CONFLICT (user_id) DO NOTHING`,
      [userId, today]
    );
    res = await query(`SELECT * FROM user_streaks WHERE user_id = $1`, [userId]);
  }
  return res.rows[0];
}

export async function recordUserActivity(userId: number) {
  if (!await isDbActive()) return;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const streakObj = await getUserStreak(userId);
  if (streakObj.last_activity_date === today) return; // already recorded today

  if (streakObj.last_activity_date === yesterday) {
    // Increment streak
    const newStreak = streakObj.current_streak + 1;
    const newMax = Math.max(streakObj.max_streak, newStreak);
    await query(
      `UPDATE user_streaks SET current_streak = $1, max_streak = $2, last_activity_date = $3, updated_at = NOW() WHERE user_id = $4`,
      [newStreak, newMax, today, userId]
    );
  } else if (streakObj.last_activity_date && streakObj.last_activity_date < yesterday) {
    // Check if streak freeze used
    if (streakObj.streak_freezes_left > 0) {
      await query(
        `UPDATE user_streaks SET streak_freezes_left = streak_freezes_left - 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
        [today, userId]
      );
    } else {
      // Reset streak
      await query(
        `UPDATE user_streaks SET current_streak = 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
        [today, userId]
      );
    }
  } else {
    // First time
    await query(
      `UPDATE user_streaks SET current_streak = 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
      [today, userId]
    );
  }
}
