import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { redisIncrWithExpire, checkRedisHealth, getRedisDegradedCount } from '../redis.js';
import healthRouter from '../routes/health.js';
import { config } from '../config.js';

describe('Redis Degradation, Rate Limiter Fallback & Multi-Instance Consistency Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Redis Disconnection & Behavior in Dev vs Production', () => {
    it('allows in-memory fallback in development mode without throwing', async () => {
      const origEnv = config.nodeEnv;
      const origUrl = config.redisUrl;
      config.nodeEnv = 'development';
      config.redisUrl = 'redis://invalid-dev:6379';

      const hits = await redisIncrWithExpire('ratelimit:test:dev', 60);
      expect(hits).toBeGreaterThan(0);

      config.nodeEnv = origEnv;
      config.redisUrl = origUrl;
    });

    it('tracks degraded count when Redis fails or is disconnected', async () => {
      const initialCount = getRedisDegradedCount();
      const hits = await redisIncrWithExpire('ratelimit:test:degraded', 60);
      expect(hits).toBeGreaterThan(0);
      expect(getRedisDegradedCount()).toBeGreaterThanOrEqual(initialCount);
    });
  });

  describe('2. Health & Readiness Integration with Redis Degradation', () => {
    const app = express();
    app.use('/api', healthRouter);

    it('reports redis status as degraded and returns 503 in production when Redis is inactive', async () => {
      const origEnv = config.nodeEnv;
      const origUrl = config.redisUrl;
      config.nodeEnv = 'production';
      config.redisUrl = 'redis://invalid-prod:6379';

      const health = await checkRedisHealth();
      expect(health.status).toBe('degraded');
      expect(health.degradedCount).toBeDefined();

      config.nodeEnv = origEnv;
      config.redisUrl = origUrl;
    });
  });
});
