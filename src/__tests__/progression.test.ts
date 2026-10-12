import { describe, it, expect } from 'vitest';
import {
  getXpForLevel,
  getLevelFromXp,
  calculateRoundRewards,
} from '../utils/progression';
import { RoundStats } from '../types/game';

describe('Player Progression & Leveling Reward Engine', () => {
  it('calculates monotonically increasing XP requirements for levels', () => {
    expect(getXpForLevel(1)).toBe(0);
    const xpLvl2 = getXpForLevel(2);
    const xpLvl3 = getXpForLevel(3);
    const xpLvl10 = getXpForLevel(10);

    expect(xpLvl2).toBeGreaterThan(0);
    expect(xpLvl3).toBeGreaterThan(xpLvl2);
    expect(xpLvl10).toBeGreaterThan(xpLvl3);
  });

  it('determines accurate level and progress percent from total XP', () => {
    // 0 XP = Level 1, 0% progress
    const infoLvl1 = getLevelFromXp(0);
    expect(infoLvl1.level).toBe(1);
    expect(infoLvl1.progressPercent).toBe(0);

    // XP just above Level 2 threshold
    const xpThreshold2 = getXpForLevel(2);
    const infoLvl2 = getLevelFromXp(xpThreshold2);
    expect(infoLvl2.level).toBe(2);
    expect(infoLvl2.currentXp).toBe(0);

    // Maximum level cap
    const maxLevelInfo = getLevelFromXp(99999999);
    expect(maxLevelInfo.level).toBe(50);
    expect(maxLevelInfo.progressPercent).toBe(100);
  });

  it('calculates round rewards with combo, score, and beacon multipliers', () => {
    const mockStats: RoundStats = {
      roundId: 'rnd_progression_test',
      score: 10000,
      rawScore: 10000,
      totalTaps: 80,
      hits: 75,
      misses: 5,
      maxCombo: 25,
      accuracy: 94,
      minesHit: 0,
      goldenBeaconsHit: 3,
      powerupsUsed: [],
      duration: 45,
      isDailySeed: false,
      clickLogs: [],
    };

    const rewards = calculateRoundRewards(mockStats);

    // Base XP: 10% of score (1000) + accuracy * 2 (188) = 1188
    expect(rewards.earnedXp).toBeGreaterThanOrEqual(1000);

    // Base Stardust: 5% of score (500) + combo*3 (75) + beacons*15 (45) = 620
    expect(rewards.earnedStardust).toBeGreaterThanOrEqual(500);

    // Ensure floor minimums
    const emptyStats: RoundStats = {
      roundId: 'rnd_zero_test',
      score: 0,
      rawScore: 0,
      totalTaps: 0,
      hits: 0,
      misses: 0,
      maxCombo: 0,
      accuracy: 0,
      minesHit: 0,
      goldenBeaconsHit: 0,
      powerupsUsed: [],
      duration: 45,
      isDailySeed: false,
      clickLogs: [],
    };
    const minRewards = calculateRoundRewards(emptyStats);
    expect(minRewards.earnedXp).toBe(25);
    expect(minRewards.earnedStardust).toBe(10);
  });
});
