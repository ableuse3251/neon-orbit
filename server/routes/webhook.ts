import { Router, Request, Response, NextFunction } from 'express';
import { webhookCallback } from 'grammy';
import { bot } from '../../bot.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const router = Router();

// Create grammY webhook handler middleware
const grammyHandler = webhookCallback(bot, 'express', {
  secretToken: config.webhookSecret && config.webhookSecret !== 'default_webhook_secret'
    ? config.webhookSecret
    : undefined,
});

/**
 * POST /api/bot/webhook or /bot/webhook
 * Receives incoming Telegram Bot updates via Webhook (Serverless / Vercel friendly).
 */
const webhookRoute = async (req: Request, res: Response, next: NextFunction) => {
  if (!config.botToken || config.botToken.startsWith('111111111:')) {
    logger.warn('Webhook called but TELEGRAM_BOT_TOKEN is not configured.');
    return res.status(503).json({ success: false, error: 'BOT_TOKEN_NOT_CONFIGURED' });
  }

  // Security check: optional secret token verification
  if (config.webhookSecret && config.webhookSecret !== 'default_webhook_secret') {
    const receivedToken = req.headers['x-telegram-bot-api-secret-token'];
    if (receivedToken !== config.webhookSecret) {
      logger.warn('[WEBHOOK SECURITY] Invalid or missing X-Telegram-Bot-Api-Secret-Token');
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED_WEBHOOK_TOKEN' });
    }
  }

  try {
    return grammyHandler(req, res);
  } catch (err: any) {
    logger.error('Error handling Telegram webhook update:', err);
    return res.status(500).json({ success: false, error: 'WEBHOOK_HANDLING_FAILED' });
  }
};

router.post('/bot/webhook', webhookRoute);
router.post('/webhook', webhookRoute);

export default router;
