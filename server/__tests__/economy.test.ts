import { describe, it, expect } from 'vitest';
import { getLevelFromXp, calculateRoundRewards } from '../../src/utils/progression.js';
import { claimQuestReward, getUserStreak } from '../services/dailyContent.js';

describe('Economy, Wallet Safety & Daily Content Tests (F12 / NE-21)', () => {
  it('prevents negative or NaN rewards for all round inputs', () => {
    const rewardsZero = calculateRoundRewards({
      roundId: 'r1',
      score: 0,
      accuracy: 0,
      maxCombo: 0,
      goldenBeaconsHit: 0,
    } as any);

    expect(rewardsZero.earnedXp).toBeGreaterThanOrEqual(0);
    expect(rewardsZero.earnedStardust).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(rewardsZero.earnedXp)).toBe(true);
    expect(Number.isFinite(rewardsZero.earnedStardust)).toBe(true);
  });

  it('guarantees level bounds between 1 and 50', () => {
    const minLevel = getLevelFromXp(0);
    expect(minLevel.level).toBe(1);

    const maxLevel = getLevelFromXp(1_000_000_000);
    expect(maxLevel.level).toBe(50);
  });

  it('handles inactive DB gracefully for daily content and quest claiming', async () => {
    const claimRes = await claimQuestReward(123, 'quest_score_1000');
    expect(claimRes.success).toBe(false);

    const streakRes = await getUserStreak(123);
    expect(streakRes).toBeDefined();
  });
});
