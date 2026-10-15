import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, getEffectiveAllowedOrigins } from './config.js';
import { logger } from './logger.js';
import { redisIncrWithExpire } from './redis.js';
import healthRouter from './routes/health.js';
import gameRouter from './routes/game.js';
import starsRouter from './routes/stars.js';
import authRouter from './routes/auth.js';
import economyRouter from './routes/economy.js';
import adminRouter from './routes/admin.js';
import analyticsRouter from './routes/analytics.js';
import seasonsRouter from './routes/seasons.js';
import dailyContentRouter from './routes/dailyContent.js';
import viralRouter from './routes/viral.js';
import notificationsRouter from './routes/notifications.js';
import metricsRouter, { incrementHttpRequests } from './routes/metrics.js';
import webhookRouter from './routes/webhook.js';
import cronRouter from './routes/cron.js';

export function createApp() {
  const app = express();

  // Trust reverse proxy (e.g. Vercel, Cloud Run)
  app.set('trust proxy', 1);

  // 1. Helmet security headers with CSP for Telegram WebView
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'frame-ancestors': ["'self'", 'https://web.telegram.org', 'https://webk.telegram.org', 'https://webz.telegram.org'],
        },
      },
    })
  );

  // 2. Strict CORS policy with allowed origins
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowedOrigins = getEffectiveAllowedOrigins(config);

        // Non-browser or same-origin server-to-server requests
        if (!origin) {
          return callback(null, true);
        }

        // Exact match check
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('CORS policy error: Origin not allowed.'));
      },
      credentials: true,
    })
  );

  // 3. Strict JSON body parser limit
  app.use(express.json({ limit: '100kb' }));

  // Mount health, metrics, webhook, and cron endpoints prior to standard API rate limiting
  app.use('/api', healthRouter);
  app.use('/api', metricsRouter);
  app.use('/api', webhookRouter);
  app.use('/', webhookRouter);
  app.use('/api', cronRouter);

  // Request metrics counter
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    incrementHttpRequests();
    next();
  });

  // 4. Rate Limiter with Redis or memory store
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 150,
    skip: () => process.env.SKIP_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test',
    message: { success: false, error: 'Too many requests.' },
    store: {
      init: () => {},
      increment: async (key: string) => {
        try {
          const hits = await redisIncrWithExpire(`ratelimit:api:${key}`, 900);
          return { totalHits: hits, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
        } catch {
          // Fallback if Redis fails
          return { totalHits: 1, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
        }
      },
      decrement: async () => {},
      resetKey: async () => {},
    },
  });
  app.use('/api/', apiLimiter);

  // 5. Mount Authenticated API Routes
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

  // 6. 404 Handler for unhandled /api requests
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'NOT_FOUND' });
  });

  // 7. Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled API Error:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}

export const app = createApp();
export default app;
