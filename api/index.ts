import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../server/config.js';
import { redisIncrWithExpire } from '../server/redis.js';
import healthRouter from '../server/routes/health.js';
import gameRouter from '../server/routes/game.js';
import starsRouter from '../server/routes/stars.js';
import authRouter from '../server/routes/auth.js';
import economyRouter from '../server/routes/economy.js';
import adminRouter from '../server/routes/admin.js';
import analyticsRouter from '../server/routes/analytics.js';
import seasonsRouter from '../server/routes/seasons.js';
import dailyContentRouter from '../server/routes/dailyContent.js';
import viralRouter from '../server/routes/viral.js';
import notificationsRouter from '../server/routes/notifications.js';
import metricsRouter, { incrementHttpRequests } from '../server/routes/metrics.js';

const app = express();
app.set('trust proxy', 1);

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
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.telegram.org')) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy error: Origin not allowed.'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));

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

app.use((req, res, next) => {
  incrementHttpRequests();
  next();
});

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

export default app;
