import { DailyQuest, UserDailyQuest } from "../types/game";
import {
  DAILY_QUESTS_POOL as SHARED_POOL,
  DailyQuestDefinition,
  getDailyQuestsForDate as sharedGetDailyQuestsForDate,
  getTodayUtcDate as sharedGetTodayUtcDate,
  getSecondsUntilUtcMidnight as sharedGetSecondsUntilUtcMidnight,
} from "../shared/dailyQuests";

export type { DailyQuest, UserDailyQuest };
export {
  sharedGetTodayUtcDate as getTodayUtcDate,
  sharedGetSecondsUntilUtcMidnight as getSecondsUntilUtcMidnight,
};

export const DAILY_QUESTS_POOL: DailyQuest[] = SHARED_POOL.map((q) => ({
  id: q.id,
  title_en: q.titleEn,
  title_ru: q.titleRu,
  type: q.type,
  target_value: q.targetValue,
  reward_dust: q.rewardDust,
  reward_exp: q.rewardXp,
}));

export function getDailyQuestsForDate(dateStr: string): DailyQuest[] {
  const shared = sharedGetDailyQuestsForDate(dateStr);
  return shared.map((q) => ({
    id: q.id,
    title_en: q.titleEn,
    title_ru: q.titleRu,
    type: q.type,
    target_value: q.targetValue,
    reward_dust: q.rewardDust,
    reward_exp: q.rewardXp,
  }));
}

const DAILY_QUESTS_STORAGE_PREFIX = "neon_orbit_daily_quests_";

export function loadUserDailyQuests(dateStr: string = sharedGetTodayUtcDate()): UserDailyQuest[] {
  if (typeof localStorage === "undefined") {
    return getDailyQuestsForDate(dateStr).map((q) => ({
      ...q,
      progress: 0,
      is_completed: false,
      is_claimed: false,
      reset_date: dateStr,
    }));
  }

  const key = `${DAILY_QUESTS_STORAGE_PREFIX}${dateStr}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse daily quests from storage:", e);
    }
  }

  // Generate initial quests for today
  const baseQuests = getDailyQuestsForDate(dateStr);
  const initialQuests: UserDailyQuest[] = baseQuests.map((q) => ({
    ...q,
    progress: 0,
    is_completed: false,
    is_claimed: false,
    reset_date: dateStr,
  }));
  saveUserDailyQuests(initialQuests, dateStr);
  return initialQuests;
}

export function saveUserDailyQuests(quests: UserDailyQuest[], dateStr: string = sharedGetTodayUtcDate()): void {
  if (typeof localStorage === "undefined") return;
  const key = `${DAILY_QUESTS_STORAGE_PREFIX}${dateStr}`;
  try {
    localStorage.setItem(key, JSON.stringify(quests));
  } catch (e) {
    console.error("Failed to save daily quests:", e);
  }
}

export interface RoundProgressionData {
  score: number;
  maxCombo: number;
  hits: number;
  goldenBeaconsHit?: number;
  isDailyChallenge?: boolean;
}

export function applyRoundProgressToQuests(
  quests: UserDailyQuest[],
  round: RoundProgressionData,
  dateStr: string = sharedGetTodayUtcDate()
): UserDailyQuest[] {
  const updated = quests.map((q) => {
    if (q.is_claimed) return q;

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
      default:
        break;
    }

    const capped = Math.min(q.target_value, newProgress);
    const isCompleted = capped >= q.target_value;

    return {
      ...q,
      progress: capped,
      is_completed: isCompleted,
    };
  });

  saveUserDailyQuests(updated, dateStr);
  return updated;
}

export function claimUserDailyQuestLocally(
  questId: string,
  dateStr: string = sharedGetTodayUtcDate()
): { success: boolean; error?: string; rewardDust?: number; rewardExp?: number } {
  const quests = loadUserDailyQuests(dateStr);
  const targetQuest = quests.find((q) => q.id === questId);

  if (!targetQuest) {
    return { success: false, error: "Quest not found for today" };
  }

  if (!targetQuest.is_completed) {
    return { success: false, error: "Quest condition not fulfilled yet" };
  }

  if (targetQuest.is_claimed) {
    return { success: false, error: "Quest already claimed today" };
  }

  targetQuest.is_claimed = true;
  saveUserDailyQuests(quests, dateStr);

  return {
    success: true,
    rewardDust: targetQuest.reward_dust,
    rewardExp: targetQuest.reward_exp,
  };
}
