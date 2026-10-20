import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, configErrors, getEffectiveAllowedOrigins } from './config.js';
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

class CorsError extends Error {
  status: number;
  constructor(message = 'CORS policy error: Origin not allowed.') {
    super(message);
    this.name = 'CorsError';
    this.status = 403;
  }
}

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

        // Allow any vercel.app domain
        if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
          return callback(null, true);
        }

        return callback(new CorsError('CORS policy error: Origin not allowed.'));
      },
      credentials: true,
    })
  );

  // 3. Strict JSON body parser limit
  app.use(express.json({ limit: '100kb' }));

  // Mount health endpoints FIRST so liveness probes and client offline checks can always respond
  app.use('/api', healthRouter);

  // Configuration Error Guard for API routes
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    if (configErrors && configErrors.length > 0) {
      return res.status(500).json({
        success: false,
        error: 'CONFIGURATION_ERROR',
        message: 'Server misconfigured. Missing required production environment variables.',
        details: configErrors,
      });
    }
    next();
  });

  // Mount metrics, webhook, and cron endpoints prior to standard API rate limiting
  app.use('/api', metricsRouter);
  app.use('/api', webhookRouter);
  app.use('/api', cronRouter);

  // Request metrics counter
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    incrementHttpRequests();
    next();
  });

  // 4. Rate Limiter with Redis or stateful in-memory fallback
  const localRateLimitMap = new Map<string, { count: number; resetTime: number }>();

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 1200,
    skip: () => process.env.SKIP_RATE_LIMIT === 'true' || process.env.NODE_ENV === 'test',
    keyGenerator: (req: Request) => {
      // 1. Extract Telegram User ID from Authorization / initData header for dedicated per-user quota
      const authHeader = req.headers['authorization'] || (req.headers['x-init-data'] as string) || '';
      if (typeof authHeader === 'string' && authHeader.length > 5) {
        try {
          const match = authHeader.match(/"id":\s*(\d+)/) || authHeader.match(/user=([^&]+)/);
          if (match) {
            if (match[0].startsWith('"id"')) {
              return `user_${match[1]}`;
            }
            const decoded = decodeURIComponent(match[1]);
            const parsed = JSON.parse(decoded);
            if (parsed?.id) return `user_${parsed.id}`;
          }
        } catch {
          // fallback to client IP
        }
      }
      // 2. Client IP from standard reverse proxy headers
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        const clientIp = forwarded.split(',')[0].trim();
        if (clientIp) return `ip_${clientIp}`;
      }
      const realIp = req.headers['x-real-ip'];
      if (typeof realIp === 'string' && realIp.trim()) {
        return `ip_${realIp.trim()}`;
      }
      return `ip_${req.ip || 'client'}`;
    },
    message: { success: false, error: 'Too many requests.' },
    store: {
      init: () => {},
      increment: async (key: string) => {
        try {
          const hits = await redisIncrWithExpire(`ratelimit:api:${key}`, 900);
          return { totalHits: hits, resetTime: new Date(Date.now() + 15 * 60 * 1000) };
        } catch (err) {
          logger.warn(`Redis rate limit failed for ${key}, falling back to in-memory counter:`, err);
          const now = Date.now();
          const entry = localRateLimitMap.get(key);
          if (!entry || entry.resetTime <= now) {
            const resetTime = now + 15 * 60 * 1000;
            localRateLimitMap.set(key, { count: 1, resetTime });
            return { totalHits: 1, resetTime: new Date(resetTime) };
          }
          entry.count += 1;
          return { totalHits: entry.count, resetTime: new Date(entry.resetTime) };
        }
      },
      decrement: async (key: string) => {
        const entry = localRateLimitMap.get(key);
        if (entry && entry.count > 0) {
          entry.count -= 1;
        }
      },
      resetKey: async (key: string) => {
        localRateLimitMap.delete(key);
      },
    },
  });
  app.use('/api/', apiLimiter);

  // 5. Mount Authenticated API Routes
  app.use('/api/auth', authRouter);
  app.use('/api', authRouter);
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

    if (err.name === 'CorsError' || (err.message && err.message.includes('CORS policy error'))) {
      return res.status(403).json({
        success: false,
        error: 'CORS_FORBIDDEN',
      });
    }

    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'test';
    const clientError = statusCode < 500 ? err.message : (isDev ? (err.message || 'INTERNAL_SERVER_ERROR') : 'INTERNAL_SERVER_ERROR');

    res.status(statusCode).json({
      success: false,
      error: clientError || 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}

export const app = createApp();
export default app;
