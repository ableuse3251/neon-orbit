import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db.js';
import { checkRedisHealth } from '../redis.js';
import { config } from '../config.js';

const router = Router();

router.get('/health/liveness', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/readiness', async (req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();
  const redisHealth = await checkRedisHealth();

  // Readiness: DB must be healthy in production
  const isReady = dbHealth.status === 'ok' && (config.nodeEnv !== 'production' || redisHealth.status !== 'degraded');

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
  });
});

export default router;
