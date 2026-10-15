import { Router, Request, Response, NextFunction } from 'express';
import { webhookCallback } from 'grammy';
import crypto from 'crypto';
import { bot } from '../../bot.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const router = Router();

const originalStart = bot.start;
const grammyHandler = webhookCallback(bot, 'express', {
  secretToken: config.webhookSecret && config.webhookSecret !== 'default_webhook_secret'
    ? config.webhookSecret
    : undefined,
});
bot.start = originalStart;

function safeTokenCompare(provided: string, expected: string): boolean {
  try {
    const bufA = Buffer.from(provided);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

const webhookRoute = async (req: Request, res: Response, next: NextFunction) => {
  const isDevLike = config.nodeEnv === 'development' || config.nodeEnv === 'test';

  if (!config.botToken || config.botToken.startsWith('111111111:')) {
    logger.warn('Webhook called but TELEGRAM_BOT_TOKEN is not configured.');
    return res.status(503).json({ success: false, error: 'BOT_TOKEN_NOT_CONFIGURED' });
  }

  if (!config.webhookSecret || config.webhookSecret === 'default_webhook_secret') {
    if (!isDevLike) {
      logger.error('CRITICAL: WEBHOOK_SECRET is not configured in production.');
      return res.status(503).json({ success: false, error: 'WEBHOOK_SECRET_NOT_CONFIGURED' });
    }
  }

  const receivedToken = req.headers['x-telegram-bot-api-secret-token'];
  if (config.webhookSecret && config.webhookSecret !== 'default_webhook_secret') {
    if (!receivedToken || typeof receivedToken !== 'string' || !safeTokenCompare(receivedToken, config.webhookSecret)) {
      logger.warn('[WEBHOOK SECURITY] Invalid or missing X-Telegram-Bot-Api-Secret-Token');
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED_WEBHOOK_TOKEN' });
    }
  } else if (!isDevLike) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED_WEBHOOK_TOKEN' });
  }

  try {
    return grammyHandler(req, res);
  } catch (err: any) {
    logger.error('Error handling Telegram webhook update:', err);
    return res.status(500).json({ success: false, error: 'WEBHOOK_HANDLING_FAILED' });
  }
};

router.post('/bot/webhook', webhookRoute);

export default router;
