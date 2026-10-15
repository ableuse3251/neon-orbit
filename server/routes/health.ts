import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db.js';
import { checkRedisHealth } from '../redis.js';
import { getMigrationStatus } from '../migrations.js';
import { config } from '../config.js';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
  // 3. Database migrations must be successfully completed, or in serverless mode (e.g. Vercel)
  //    where migrations are executed externally via CI/CD, migration status is not marked failed.
  const isServerless = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isDbReady = dbHealth.status === 'ok' || (config.nodeEnv !== 'production' && dbHealth.status === 'disabled');
  const isRedisReady = config.nodeEnv !== 'production' || redisHealth.status !== 'degraded';
  const isMigrationsReady =
    migrationStatus.status === 'completed' ||
    (config.mockModeAllowed && migrationStatus.status === 'skipped') ||
    (isServerless && migrationStatus.status !== 'failed');

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
