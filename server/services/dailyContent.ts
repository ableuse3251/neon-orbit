import { query, transaction, isDbActive } from "../db.js";
import {
  DAILY_QUESTS_POOL,
  getDailyQuestsForDate,
  getTodayUtcDate,
} from "../../src/shared/dailyQuests.js";

const mockUserDailyQuests = new Map<string, any[]>();

export function getMockUserDailyQuests(userId: number, dateStr: string = getTodayUtcDate()) {
  const key = `${userId}_${dateStr}`;
  if (!mockUserDailyQuests.has(key)) {
    const dailyDefs = getDailyQuestsForDate(dateStr);
    mockUserDailyQuests.set(
      key,
      dailyDefs.map((q) => ({
        id: q.id,
        title_en: q.titleEn,
        title_ru: q.titleRu,
        type: q.type,
        target_value: q.targetValue,
        reward_dust: q.rewardDust,
        reward_exp: q.rewardXp,
        progress: 0,
        is_completed: false,
        is_claimed: false,
        reset_date: dateStr,
      }))
    );
  }
  return mockUserDailyQuests.get(key)!;
}

export function clearMockUserDailyQuests() {
  mockUserDailyQuests.clear();
}

async function ensureDailyQuestsCatalog(client: any) {
  for (const q of DAILY_QUESTS_POOL) {
    await client.query(
      `INSERT INTO daily_quests (id, title_en, title_ru, type, target_value, reward_dust, reward_exp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         title_en = EXCLUDED.title_en,
         title_ru = EXCLUDED.title_ru,
         type = EXCLUDED.type,
         target_value = EXCLUDED.target_value,
         reward_dust = EXCLUDED.reward_dust,
         reward_exp = EXCLUDED.reward_exp`,
      [q.id, q.titleEn, q.titleRu, q.type, q.targetValue, q.rewardDust, q.rewardXp]
    );
  }
}

export async function getUserDailyQuests(userId: number) {
  const today = getTodayUtcDate();

  if (!(await isDbActive())) {
    return getMockUserDailyQuests(userId, today);
  }

  await transaction(async (client: any) => {
    await ensureDailyQuestsCatalog(client);

    const existing = await client.query(
      `SELECT uq.id
       FROM user_daily_quests uq
       WHERE uq.user_id = $1 AND uq.reset_date = $2`,
      [userId, today]
    );

    if (existing.rows.length < 3) {
      const todayDefs = getDailyQuestsForDate(today);
      for (const q of todayDefs) {
        await client.query(
          `INSERT INTO user_daily_quests (user_id, quest_id, progress, target_value, is_completed, is_claimed, reset_date)
           VALUES ($1, $2, 0, $3, false, false, $4)
           ON CONFLICT (user_id, quest_id, reset_date) DO NOTHING`,
          [userId, q.id, q.targetValue, today]
        );
      }
    }
  });

  const res = await query(
    `SELECT q.id, q.title_en, q.title_ru, q.type, q.reward_dust, q.reward_exp,
            uq.progress, uq.target_value, uq.is_completed, uq.is_claimed
     FROM daily_quests q
     JOIN user_daily_quests uq ON q.id = uq.quest_id
     WHERE uq.user_id = $1 AND uq.reset_date = $2
     ORDER BY q.id ASC`,
    [userId, today]
  );

  return res.rows;
}

export interface RoundProgressionPayload {
  score: number;
  maxCombo: number;
  hits: number;
  goldenBeaconsHit?: number;
  isDailyChallenge?: boolean;
}

export async function updateQuestProgressForRound(userId: number, round: RoundProgressionPayload) {
  const today = getTodayUtcDate();

  if (!(await isDbActive())) {
    const quests = getMockUserDailyQuests(userId, today);
    for (const q of quests) {
      if (q.is_claimed) continue;
      let newProgress = q.progress;
      switch (q.type) {
        case "rounds":
          newProgress = q.progress + 1;
          break;
        case "score":
          newProgress = Math.max(q.progress, round.score);
          break;
        case "combo":
          newProgress = Math.max(q.progress, round.maxCombo);
          break;
        case "targets":
          newProgress = q.progress + (round.hits || 0);
          break;
        case "beacon":
          newProgress = q.progress + (round.goldenBeaconsHit || 0);
          break;
        case "daily_challenge":
          if (round.isDailyChallenge) {
            newProgress = q.progress + 1;
          }
          break;
      }
      q.progress = Math.min(q.target_value, newProgress);
      q.is_completed = q.progress >= q.target_value;
    }
    return;
  }

  await transaction(async (client: any) => {
    const existing = await client.query(
      `SELECT uq.id, uq.quest_id, uq.progress, uq.target_value, q.type
       FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.reset_date = $2 AND uq.is_claimed = false`,
      [userId, today]
    );

    for (const uq of existing.rows) {
      let newProgress = Number(uq.progress);
      switch (uq.type) {
        case "rounds":
          newProgress = newProgress + 1;
          break;
        case "score":
          newProgress = Math.max(newProgress, round.score);
          break;
        case "combo":
          newProgress = Math.max(newProgress, round.maxCombo);
          break;
        case "targets":
          newProgress = newProgress + (round.hits || 0);
          break;
        case "beacon":
          newProgress = newProgress + (round.goldenBeaconsHit || 0);
          break;
        case "daily_challenge":
          if (round.isDailyChallenge) {
            newProgress = newProgress + 1;
          }
          break;
      }

      const capped = Math.min(Number(uq.target_value), newProgress);
      const isCompleted = capped >= Number(uq.target_value);

      await client.query(
        `UPDATE user_daily_quests
         SET progress = $1, is_completed = $2
         WHERE id = $3`,
        [capped, isCompleted, uq.id]
      );
    }
  });
}

export async function updateQuestProgress(userId: number, type: string, amount: number = 1) {
  if (!(await isDbActive())) return;
  const today = getTodayUtcDate();

  await transaction(async (client: any) => {
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
  const today = getTodayUtcDate();

  if (!(await isDbActive())) {
    const quests = getMockUserDailyQuests(userId, today);
    const q = quests.find((item) => item.id === questId);
    if (!q) {
      return { success: false, error: "Quest not found" };
    }
    if (!q.is_completed) {
      return { success: false, error: "Quest condition not fulfilled yet" };
    }
    if (q.is_claimed) {
      return { success: false, error: "Already claimed today" };
    }
    q.is_claimed = true;
    return {
      success: true,
      rewardStardust: q.reward_dust,
      rewardXp: q.reward_exp,
    };
  }

  return await transaction(async (client: any) => {
    const uqRes = await client.query(
      `SELECT uq.*, q.reward_dust, q.reward_exp
       FROM user_daily_quests uq
       JOIN daily_quests q ON uq.quest_id = q.id
       WHERE uq.user_id = $1 AND uq.quest_id = $2 AND uq.reset_date = $3
       FOR UPDATE`,
      [userId, questId, today]
    );

    if (uqRes.rows.length === 0) {
      return { success: false, error: "Quest not found" };
    }

    const uq = uqRes.rows[0];
    if (!uq.is_completed) {
      return { success: false, error: "Quest condition not fulfilled yet" };
    }
    if (uq.is_claimed) {
      return { success: false, error: "Already claimed today" };
    }

    const updateRes = await client.query(
      `UPDATE user_daily_quests
       SET is_claimed = true
       WHERE id = $1 AND is_claimed = false
       RETURNING id`,
      [uq.id]
    );

    if (updateRes.rows.length === 0) {
      return { success: false, error: "Already claimed today" };
    }

    await client.query(
      `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    await client.query(
      `UPDATE wallets
       SET stardust = stardust + $1, xp = xp + $2
       WHERE user_id = $3`,
      [uq.reward_dust, uq.reward_exp, userId]
    );

    return {
      success: true,
      rewardStardust: Number(uq.reward_dust),
      rewardXp: Number(uq.reward_exp),
    };
  });
}

export async function getActiveGoldenHour() {
  if (!(await isDbActive())) return null;
  const res = await query(
    `SELECT * FROM golden_hours WHERE starts_at <= NOW() AND ends_at >= NOW() ORDER BY starts_at DESC LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function getActiveLimitedEvents() {
  if (!(await isDbActive())) return [];
  const res = await query(
    `SELECT * FROM limited_events WHERE is_active = true AND starts_at <= NOW() AND ends_at >= NOW()`
  );
  return res.rows;
}

export async function getUserStreak(userId: number) {
  if (!(await isDbActive())) return { currentStreak: 1, maxStreak: 1, streakFreezesLeft: 1 };
  const today = getTodayUtcDate();
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
  if (!(await isDbActive())) return;
  const today = getTodayUtcDate();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const streakObj = await getUserStreak(userId);
  if (streakObj.last_activity_date === today) return;
  if (streakObj.last_activity_date === yesterday) {
    const newStreak = streakObj.current_streak + 1;
    const newMax = Math.max(streakObj.max_streak, newStreak);
    await query(
      `UPDATE user_streaks SET current_streak = $1, max_streak = $2, last_activity_date = $3, updated_at = NOW() WHERE user_id = $4`,
      [newStreak, newMax, today, userId]
    );
  } else if (streakObj.last_activity_date && streakObj.last_activity_date < yesterday) {
    if (streakObj.streak_freezes_left > 0) {
      await query(
        `UPDATE user_streaks SET streak_freezes_left = streak_freezes_left - 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
        [today, userId]
      );
    } else {
      await query(
        `UPDATE user_streaks SET current_streak = 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
        [today, userId]
      );
    }
  } else {
    await query(
      `UPDATE user_streaks SET current_streak = 1, last_activity_date = $1, updated_at = NOW() WHERE user_id = $2`,
      [today, userId]
    );
  }
}
