import express from 'express';
import path from 'path';
import { config } from './server/config.js';
import { logger, setupUnhandledErrorHandlers } from './server/logger.js';
import { runMigrations } from './server/migrations.js';
import { closeDb } from './server/db.js';
import { closeRedis } from './server/redis.js';
import { startNotificationWorker, stopNotificationWorker } from './server/services/notifications.js';
import { startPaymentReconciliationWorker, stopPaymentReconciliationWorker } from './server/routes/stars.js';
import { setupTelegramBot, bot } from './bot.js';
import app from './server/app.js';

setupUnhandledErrorHandlers();

if (config.nodeEnv === 'production' && !config.botToken) {
  logger.error('FATAL ERROR: TELEGRAM_BOT_TOKEN environment variable is not defined in production!');
  process.exit(1);
}

async function startServer() {
  const appRole = (process.env.APP_ROLE || process.env.ROLE || 'all').toLowerCase();
  logger.info(`Starting Neon Orbit instance with APP_ROLE: ${appRole}`);

  if (config.nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 1. Start HTTP server FIRST so port is open immediately
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Neon Orbit server listening on http://0.0.0.0:${config.port} (role: ${appRole}, env: ${config.nodeEnv})`);
  });

  // 2. Run migrations after server is listening
  try {
    await runMigrations();
  } catch (err) {
    logger.error('FATAL ERROR: Failed to run database migrations:', err);
    if (config.nodeEnv === 'production' && !config.mockModeAllowed) {
      process.exit(1);
    }
  }

  // 3. Start background workers for standalone process mode
  if (appRole === 'all' || appRole === 'worker') {
    startNotificationWorker();
    startPaymentReconciliationWorker();
  }

  // 4. Setup Telegram bot (only if role is 'all' or 'telegram-bot')
  if (appRole === 'all' || appRole === 'telegram-bot') {
    try {
      await setupTelegramBot(app);
    } catch (err) {
      logger.error('Failed to setup Telegram bot:', err);
    }
  } else {
    logger.info(`Skipping Telegram bot long-polling startup for role: ${appRole}`);
  }

  // Graceful Shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) logger.error('Error closing HTTP server:', err);
        resolve();
      });
    });

    stopNotificationWorker();
    stopPaymentReconciliationWorker();
    try {
      if (bot.isInited()) {
        await bot.stop();
      }
    } catch (err) {
      logger.error('Bot stop error:', err);
    }

    try {
      await Promise.all([closeDb(), closeRedis()]);
      logger.info('Database and Redis connections closed.');
    } catch (err) {
      logger.error('Error closing connections:', err);
    }

    clearTimeout(forceExitTimer);
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
