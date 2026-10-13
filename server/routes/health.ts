import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db.js';
import { checkRedisHealth } from '../redis.js';
import { getMigrationStatus } from '../migrations.js';
import { config } from '../config.js';

const router = Router();

router.get('/health/liveness', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/readiness', async (req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();
  const redisHealth = await checkRedisHealth();
  const migrationStatus = getMigrationStatus();

  // Readiness requirements:
  // 1. Database must be actively connected and healthy (or disabled in development/mock fallback)
  // 2. Redis cache must not be degraded in production
  // 3. Database migrations must be successfully completed (or skipped if in mock fallback mode)
  const isDbReady = dbHealth.status === 'ok' || (config.nodeEnv !== 'production' && dbHealth.status === 'disabled');
  const isRedisReady = config.nodeEnv !== 'production' || redisHealth.status !== 'degraded';
  const isMigrationsReady = migrationStatus.status === 'completed' || (config.mockModeAllowed && migrationStatus.status === 'skipped');

  const isReady = isDbReady && isRedisReady && isMigrationsReady;

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      migrations: migrationStatus,
    },
  });
});

export default router;
