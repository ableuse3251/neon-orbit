import { Router, Request, Response } from 'express';
import { reconcilePendingPayments } from './stars.js';
import { processNotificationQueue } from '../services/notifications.js';
import { checkAndRolloverSeasons } from '../services/seasons.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const router = Router();

function isAuthorizedCron(req: Request): boolean {
  // 1. Allow Vercel Cron header
  if (req.headers['x-vercel-cron'] === '1') {
    return true;
  }

  // 2. Check Bearer token matching CRON_SECRET or METRICS_SECRET
  const expectedSecret = process.env.CRON_SECRET || config.metricsSecret;
  if (expectedSecret && expectedSecret !== 'default_metrics_secret') {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${expectedSecret}`) {
      return true;
    }
  }

  // 3. Allow in development or test mode
  if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
    return true;
  }

  return false;
}

// 1. Cron endpoint for payment reconciliation
router.all('/cron/payments-reconcile', async (req: Request, res: Response) => {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED_CRON' });
  }

  try {
    const stats = await reconcilePendingPayments();
    return res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron payment reconciliation error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

// 2. Cron endpoint for notification queue processing
router.all('/cron/notifications', async (req: Request, res: Response) => {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED_CRON' });
  }

  try {
    await processNotificationQueue();
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron notification processing error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

// 3. Cron endpoint for season / leaderboard rollover
router.all('/cron/leaderboard-reset', async (req: Request, res: Response) => {
  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED_CRON' });
  }

  try {
    const season = await checkAndRolloverSeasons();
    return res.json({ success: true, activeSeason: season?.id || null, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron season reset error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'INTERNAL_ERROR' });
  }
});

export default router;
