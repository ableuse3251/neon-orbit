import { describe, it, expect } from 'vitest';
import { redisZAdd, redisZScore, redisZRevRank, redisZRevRange, redisZRem } from '../redis.js';

describe('Leaderboard Redis Sorted Sets & Caching Logic', () => {
  it('manages sorted set score ordering and rankings correctly', async () => {
    const key = `test_leaderboard_suite_${Date.now()}`;

    // Add players with scores
    await redisZAdd(key, 12000, 'pilot_alpha');
    await redisZAdd(key, 18500, 'pilot_beta');
    await redisZAdd(key, 9400, 'pilot_gamma');

    // Scores
    const scoreBeta = await redisZScore(key, 'pilot_beta');
    expect(scoreBeta).toBe(18500);

    const scoreAlpha = await redisZScore(key, 'pilot_alpha');
    expect(scoreAlpha).toBe(12000);

    // RevRank (0-indexed highest to lowest)
    const rankBeta = await redisZRevRank(key, 'pilot_beta');
    expect(rankBeta).toBe(0); // 1st place

    const rankAlpha = await redisZRevRank(key, 'pilot_alpha');
    expect(rankAlpha).toBe(1); // 2nd place

    const rankGamma = await redisZRevRank(key, 'pilot_gamma');
    expect(rankGamma).toBe(2); // 3rd place

    // Range top 2
    const top2 = await redisZRevRange(key, 0, 1);
    expect(top2).toEqual(['pilot_beta', 'pilot_alpha']);

    // Remove user on privacy toggle or ban
    await redisZRem(key, 'pilot_beta');
    const rankAfterRem = await redisZRevRank(key, 'pilot_beta');
    expect(rankAfterRem).toBeNull();
  });
});
