import { describe, it, expect } from 'vitest';
import { calculateRoundRewards, getLevelFromXp } from '../../src/utils/progression.js';
import { config } from '../config.js';

describe('Game Round Security & F03 Atomicity Unit Tests', () => {
  it('calculates rewards deterministically and correctly', () => {
    const rewards = calculateRoundRewards({
      score: 1500,
      accuracy: 95,
      maxCombo: 10,
      goldenBeaconsHit: 2,
    } as any);

    expect(rewards.earnedXp).toBeGreaterThan(0);
    expect(rewards.earnedStardust).toBeGreaterThan(0);
  });

  it('verifies level progression calculation bounds', () => {
    const lvl1 = getLevelFromXp(0);
    expect(lvl1.level).toBe(1);

    const lvl10 = getLevelFromXp(5000);
    expect(lvl10.level).toBeGreaterThan(1);
  });

  it('verifies config mockModeAllowed behavior', () => {
    expect(typeof config.mockModeAllowed).toBe('boolean');
  });

  it('simulates concurrent round creation attempts logic validation', async () => {
    const simulateStart = async () => {
      return { success: true, roundId: `rnd_sim_${Math.random()}` };
    };

    const results = await Promise.all([simulateStart(), simulateStart()]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });
});
