import { describe, it, expect } from 'vitest';
import { redisZAdd, redisZRem } from '../redis.js';
import { removeUserFromAllLeaderboards } from '../services/leaderboard.js';
import { config } from '../config.js';

describe('F19 Redis Fallback & Consistency Tests (NE-16)', () => {
  it('correctly handles sorted set addition and removal across global and daily keys', async () => {
    const testUserId = 'user_test_999';
    await redisZAdd('leaderboard:global', 15000, testUserId);
    const todayStr = new Date().toISOString().split('T')[0];
    await redisZAdd(`leaderboard:daily:${todayStr}`, 15000, testUserId);

    // Remove user from all leaderboards
    await expect(removeUserFromAllLeaderboards(testUserId)).resolves.toBeUndefined();
  });

  it('throws error in production mode if redisUrl is set but write fails / disconnected', async () => {
    const originalEnv = config.nodeEnv;
    const originalUrl = config.redisUrl;

    config.nodeEnv = 'production';
    config.redisUrl = 'redis://invalid:6379';

    // In production mode with redisUrl configured, write operations should fail when disconnected
    await expect(redisZAdd('leaderboard:global', 100, 'hacker')).rejects.toThrow();

    config.nodeEnv = originalEnv;
    config.redisUrl = originalUrl;
  });
});
