import express, { Request, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './server/config.js';
import { logger, setupUnhandledErrorHandlers } from './server/logger.js';
import { runMigrations } from './server/migrations.js';
import { closeDb } from './server/db.js';
import { closeRedis, redisIncrWithExpire } from './server/redis.js';
import { stopNotificationWorker } from './server/services/notifications.js';
import { setupTelegramBot, bot } from './bot.js';
import healthRouter from './server/routes/health.js';
import gameRouter from './server/routes/game.js';
import starsRouter from './server/routes/stars.js';
import authRouter from './server/routes/auth.js';
import economyRouter from './server/routes/economy.js';
import adminRouter from './server/routes/admin.js';
import analyticsRouter from './server/routes/analytics.js';
import seasonsRouter from './server/routes/seasons.js';
import dailyContentRouter from './server/routes/dailyContent.js';
import viralRouter from './server/routes/viral.js';
import notificationsRouter from './server/routes/notifications.js';
import metricsRouter, { incrementHttpRequests } from './server/routes/metrics.js';

setupUnhandledErrorHandlers();

const app = express();

// Trust reverse proxy (e.g., Cloud Run, Railway)
app.set('trust proxy', 1);

if (config.nodeEnv === 'production' && !config.botToken) {
  logger.error('FATAL ERROR: TELEGRAM_BOT_TOKEN environment variable is not defined in production!');
  process.exit(1);
}

// 1. Helmet security headers with CSP for Telegram WebView
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "frame-ancestors": ["'self'", "https://web.telegram.org", "https://webk.telegram.org", "https://webz.telegram.org"],
      },
    },
  })
);

// 2. Strict CORS policy
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        config.appUrl,
        'https://telegram.org',
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org',
      ].filter(Boolean) as string[];
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.telegram.org') || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy error: Origin not allowed.'));
    },
    credentials: true,
  })
);

// 3. Strict JSON body parser limit
app.use(express.json({ limit: '100kb' }));

// 4. Distributed Rate Limiter across replicas with Redis store
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests.' },
  store: {
    init: () => {},
    increment: async (key: string) => {
      try {
        const hits = await redisIncrWithExpire(`ratelimit:api:${key}`, 900);
        return { totalHits: hits, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
      } catch {
        return { totalHits: 1, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
      }
    },
    decrement: async () => {},
    resetKey: async () => {},
  },
});
app.use('/api/', apiLimiter);

// Request metrics counter
app.use((req, res, next) => {
  incrementHttpRequests();
  next();
});

// 5. Mount API Routes
app.use('/api', healthRouter);
app.use('/api', metricsRouter);
app.use('/api/auth', authRouter);
app.use('/api', gameRouter);
app.use('/api', starsRouter);
app.use('/api', economyRouter);
app.use('/api', adminRouter);
app.use('/api', analyticsRouter);
app.use('/api', seasonsRouter);
app.use('/api', dailyContentRouter);
app.use('/api', viralRouter);
app.use('/api', notificationsRouter);

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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 1. Start HTTP server FIRST so port is open immediately for Cloud Run probes
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

  // 3. Setup Telegram bot (only if role is 'all' or 'telegram-bot')
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
    
    // Stop accepting requests
    server.close();
    
    // Stop workers and polling
    stopNotificationWorker();
    try {
      if (bot.isInited()) {
        await bot.stop();
      }
    } catch (err) {
      logger.error('Bot stop error:', err);
    }
    
    // Close connections
    try {
      await Promise.all([closeDb(), closeRedis()]);
      logger.info('Database and Redis connections closed.');
    } catch (err) {
      logger.error('Error closing connections:', err);
    }
    
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
