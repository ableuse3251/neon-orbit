import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { reconcilePendingPayments } from './stars.js';
import { processNotificationQueue } from '../services/notifications.js';
import { checkAndRolloverSeasons } from '../services/seasons.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const router = Router();

function isAuthorizedCron(req: Request): { authorized: boolean; status?: number } {
  const cronSecret = process.env.CRON_SECRET;
  const isDevLike = config.nodeEnv === 'development' || config.nodeEnv === 'test';

  if (!cronSecret) {
    if (isDevLike) {
      return { authorized: true };
    }
    return { authorized: false, status: 503 };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, status: 401 };
  }

  const token = authHeader.substring(7);
  try {
    const hashedProvided = crypto.createHash('sha256').update(token).digest();
    const hashedExpected = crypto.createHash('sha256').update(cronSecret).digest();

    if (crypto.timingSafeEqual(hashedProvided, hashedExpected)) {
      return { authorized: true };
    }
  } catch {
    // fall through to 401
  }

  return { authorized: false, status: 401 };
}

// 1. Cron endpoint for payment reconciliation
router.all('/cron/payments-reconcile', async (req: Request, res: Response) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? 'CRON_NOT_CONFIGURED' : 'UNAUTHORIZED_CRON',
    });
  }

  try {
    const stats = await reconcilePendingPayments();
    return res.json({ success: true, stats, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron payment reconciliation error:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

// 2. Cron endpoint for notification queue processing
router.all('/cron/notifications', async (req: Request, res: Response) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? 'CRON_NOT_CONFIGURED' : 'UNAUTHORIZED_CRON',
    });
  }

  try {
    await processNotificationQueue();
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron notification processing error:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

// 3. Cron endpoint for season / leaderboard rollover
router.all('/cron/leaderboard-reset', async (req: Request, res: Response) => {
  const auth = isAuthorizedCron(req);
  if (!auth.authorized) {
    return res.status(auth.status || 401).json({
      success: false,
      error: auth.status === 503 ? 'CRON_NOT_CONFIGURED' : 'UNAUTHORIZED_CRON',
    });
  }

  try {
    const season = await checkAndRolloverSeasons();
    return res.json({ success: true, activeSeason: season?.id || null, timestamp: new Date().toISOString() });
  } catch (err: any) {
    logger.error('Cron season reset error:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

export default router;
