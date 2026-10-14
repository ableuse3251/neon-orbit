import { describe, it, expect, beforeEach } from "vitest";
import {
  getUserDailyQuests,
  updateQuestProgressForRound,
  claimQuestReward,
  clearMockUserDailyQuests,
} from "../services/dailyContent";
import {
  getDailyQuestsForDate,
  getTodayUtcDate,
} from "../../src/shared/dailyQuests";
import { ACHIEVEMENTS_LIST, getAchievementProgress } from "../../src/utils/progression";

describe("Daily Quests vs Achievements Separation & Gameplay Logic", () => {
  beforeEach(() => {
    clearMockUserDailyQuests();
  });

  it("1. Generates 3 deterministic daily quests that rotate based on UTC date", () => {
    const today = "2026-10-14";
    const tomorrow = "2026-10-15";

    const questsToday = getDailyQuestsForDate(today);
    const questsTomorrow = getDailyQuestsForDate(tomorrow);

    expect(questsToday.length).toBe(3);
    expect(questsTomorrow.length).toBe(3);
    expect(questsToday).not.toEqual(questsTomorrow);
  });

  it("2. Quests start with zero progress and CANNOT be claimed before completion", async () => {
    const userId = 99123;
    const quests = await getUserDailyQuests(userId);
    expect(quests.length).toBe(3);

    const firstQuest = quests[0];
    expect(firstQuest.is_completed).toBe(false);
    expect(firstQuest.is_claimed).toBe(false);

    // Attempting to claim uncompleted quest MUST fail
    const claimRes = await claimQuestReward(userId, firstQuest.id);
    expect(claimRes.success).toBe(false);
    expect((claimRes as any).error).toMatch(/condition not fulfilled/i);
  });

  it("3. Gameplay rounds advance quest progress and enable claim ONLY when target is reached", async () => {
    const userId = 99124;
    const questsBefore = await getUserDailyQuests(userId);
    const questToFulfill = questsBefore[0];

    // Simulate round gameplay that satisfies the quest
    await updateQuestProgressForRound(userId, {
      score: 10000,
      maxCombo: 15,
      hits: 150,
      goldenBeaconsHit: 10,
      isDailyChallenge: true,
    });

    const questsAfter = await getUserDailyQuests(userId);
    const fulfilledQuest = questsAfter.find((q: any) => q.id === questToFulfill.id);

    expect(fulfilledQuest.is_completed).toBe(true);
    expect(fulfilledQuest.is_claimed).toBe(false);

    // Now claim reward
    const claimRes = await claimQuestReward(userId, fulfilledQuest.id);
    expect(claimRes.success).toBe(true);
    expect(claimRes.rewardStardust).toBeGreaterThan(0);
    expect(claimRes.rewardXp).toBeGreaterThan(0);

    // Second claim attempt on the same day MUST fail
    const secondClaimRes = await claimQuestReward(userId, fulfilledQuest.id);
    expect(secondClaimRes.success).toBe(false);
    expect((secondClaimRes as any).error).toMatch(/already claimed/i);
  });

  it("4. Lifetime achievements are separate from daily quests and depend on lifetime profile stats", () => {
    const testProfile: any = {
      totalRounds: 25,
      highScore: 12000,
      maxCombo: 12,
      totalTargetsHit: 300,
      goldenBeaconsHit: 10,
      bestAccuracy: 90,
      level: 10,
      unlockedAchievements: ["first_blood"],
    };

    const firstBlood = ACHIEVEMENTS_LIST.find((a) => a.id === "first_blood")!;
    const rounds20 = ACHIEVEMENTS_LIST.find((a) => a.id === "rounds_20")!;
    const score15k = ACHIEVEMENTS_LIST.find((a) => a.id === "score_15k")!;

    const progFirstBlood = getAchievementProgress(firstBlood, testProfile);
    const progRounds20 = getAchievementProgress(rounds20, testProfile);
    const progScore15k = getAchievementProgress(score15k, testProfile);

    // first_blood already claimed -> canClaim false
    expect(progFirstBlood.isClaimed).toBe(true);
    expect(progFirstBlood.canClaim).toBe(false);

    // rounds_20 target reached (25 >= 20) and not claimed -> canClaim true
    expect(progRounds20.isCompleted).toBe(true);
    expect(progRounds20.canClaim).toBe(true);

    // score_15k target not reached (12000 < 15000) -> canClaim false
    expect(progScore15k.isCompleted).toBe(false);
    expect(progScore15k.canClaim).toBe(false);
  });
});
