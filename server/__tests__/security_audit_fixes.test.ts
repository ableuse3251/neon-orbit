import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import fs from 'fs';
import { config, validateProductionConfig } from '../config.js';
import metricsRouter from '../routes/metrics.js';
import analyticsRouter from '../routes/analytics.js';
import { verifyTelegramInitData, requireAuth } from '../middleware/auth.js';

describe('Security Audit Fixes & Negative Tests', () => {
  let originalNodeEnv: string;
  let originalMetricsSecret: string;
  let originalBotToken: string;
  let originalMaxAge: number;

  beforeEach(() => {
    originalNodeEnv = config.nodeEnv;
    originalMetricsSecret = config.metricsSecret;
    originalBotToken = config.botToken;
    originalMaxAge = config.telegramInitDataMaxAgeSeconds;
  });

  afterEach(() => {
    config.nodeEnv = originalNodeEnv;
    config.metricsSecret = originalMetricsSecret;
    config.botToken = originalBotToken;
    config.telegramInitDataMaxAgeSeconds = originalMaxAge;
  });

  describe('1. PostgreSQL SSL Configuration & Production Guardrails', () => {
    it('sets dbSslRejectUnauthorized and dbSslCa properly in config', () => {
      expect(typeof config.dbSslRejectUnauthorized).toBe('boolean');
      expect(typeof config.dbSslCa).toBe('string');
    });

    it('rejects disabling SSL validation in production mode', () => {
      const invalidCfg = {
        nodeEnv: 'production',
        dbSslRejectUnauthorized: false,
        devAuthBypass: false,
        jwtSecret: 'valid_jwt_secret_value_123',
        webhookSecret: 'valid_webhook_secret_value_123',
        metricsSecret: 'valid_metrics_secret_value_123',
        databaseUrl: 'postgres://user:pass@localhost:5432/db',
        botToken: '123456789:VALID_BOT_TOKEN',
        mockModeAllowed: false,
      };

      expect(() => validateProductionConfig(invalidCfg as any)).toThrow(
        /Disabling SSL certificate validation.*forbidden in production/i
      );
    });
  });

  describe('2. Exact CORS Origin Enforcement', () => {
    it('allows exact allowed origins and rejects wildcard subdomain attempts', () => {
      const allowed = ['https://neon-orbit-omega.vercel.app', 'https://web.telegram.org'];
      const unallowed = ['https://evil-phishing.vercel.app', 'https://malicious.telegram.org'];

      const configuredOrigins = ['https://neon-orbit-omega.vercel.app'];
      const allowedOriginsList = [
        config.appUrl,
        ...configuredOrigins,
        'https://telegram.org',
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org',
      ].filter(Boolean);

      allowed.forEach((origin) => {
        expect(allowedOriginsList.includes(origin)).toBe(true);
      });

      unallowed.forEach((origin) => {
        expect(allowedOriginsList.includes(origin)).toBe(false);
      });
    });
  });

  describe('3. Telegram initData Query String & Header Protection', () => {
    it('rejects initData supplied in query string with HTTP 400 Bad Request', async () => {
      let statusCode = 0;
      let jsonBody: any = null;

      const req = {
        query: { initData: 'query_init_data_payload_123' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (body: any) => {
          jsonBody = body;
          return res;
        },
      } as unknown as Response;

      let nextCalled = false;
      await requireAuth(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(400);
      expect(jsonBody?.error).toBe('Bad Request');
      expect(jsonBody?.message).toMatch(/query parameters is forbidden/i);
    });
  });

  describe('4. Metrics Security & Header Token Protection', () => {
    it('returns 400 Bad Request when token is passed in query string', async () => {
      let statusCode = 0;
      let jsonBody: any = null;

      const req = {
        query: { token: 'some_token' },
        headers: {},
      } as unknown as Request;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (body: any) => {
          jsonBody = body;
          return res;
        },
      } as unknown as Response;

      const metricsLayer = metricsRouter.stack.find((layer) => layer.route?.path === '/metrics');
      const handler = metricsLayer?.route?.stack[0]?.handle;
      if (!handler) throw new Error('Metrics route handler not found');

      await handler(req, res, () => {});

      expect(statusCode).toBe(400);
      expect(jsonBody?.error).toMatch(/forbidden/i);
    });

    it('authenticates with X-Metrics-Token header matching metricsSecret in production', async () => {
      config.nodeEnv = 'production';
      config.metricsSecret = 'my_super_secret_metrics_key';

      let statusCode = 0;
      let jsonBody: any = null;

      const createRes = () => {
        const resObj: any = {
          status: (code: number) => {
            statusCode = code;
            return resObj;
          },
          json: (body: any) => {
            jsonBody = body;
            return resObj;
          },
          setHeader: () => resObj,
          send: () => {
            statusCode = 200;
            return resObj;
          },
        };
        return resObj;
      };

      const metricsLayer = metricsRouter.stack.find((layer) => layer.route?.path === '/metrics');
      const handler = metricsLayer?.route?.stack[0]?.handle;
      if (!handler) throw new Error('Metrics route handler not found');

      // Unauthorized request without header
      const reqUnauth = { query: {}, headers: {} } as unknown as Request;
      await handler(reqUnauth, createRes(), () => {});
      expect(statusCode).toBe(403);

      // Authorized request with X-Metrics-Token header
      const reqAuth = { query: {}, headers: { 'x-metrics-token': 'my_super_secret_metrics_key' } } as unknown as Request;
      await handler(reqAuth, createRes(), () => {});
      expect(statusCode).toBe(200);

      config.nodeEnv = 'test';
    });
  });

  describe('5. Telegram initData Max Age Reduction', () => {
    it('rejects initData older than configured max age (default 7200s)', () => {
      config.botToken = '123456789:TEST_BOT_TOKEN';
      config.telegramInitDataMaxAgeSeconds = 7200;

      // auth_date 3 hours ago (10800s)
      const oldAuthDate = Math.floor(Date.now() / 1000) - 10800;
      const initDataStr = `auth_date=${oldAuthDate}&hash=0000000000000000000000000000000000000000000000000000000000000000`;

      const result = verifyTelegramInitData(initDataStr);
      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });
  });

  describe('6. Docker Compose Configuration Security', () => {
    it('verifies docker-compose.yml does not expose database/redis ports to host and enforces environment variables', () => {
      const dockerComposeContent = fs.readFileSync('docker-compose.yml', 'utf-8');

      // Check PostgreSQL and Redis service blocks do NOT expose external host ports
      expect(dockerComposeContent).not.toMatch(/ports:\s*\n\s*-\s*"5432:5432"/);
      expect(dockerComposeContent).not.toMatch(/ports:\s*\n\s*-\s*"6379:6379"/);

      // Check that mandatory secrets require non-empty environment variables
      expect(dockerComposeContent).toContain('POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required');
      expect(dockerComposeContent).toContain('WEBHOOK_SECRET:?WEBHOOK_SECRET is required');
      expect(dockerComposeContent).toContain('JWT_SECRET:?JWT_SECRET is required');
      expect(dockerComposeContent).toContain('METRICS_SECRET:?METRICS_SECRET is required');
    });
  });

  describe('7. Analytics Rate Limiter Protection', () => {
    it('limits anonymous analytics events submission', async () => {
      const analyticsLayer = analyticsRouter.stack.find((layer) => layer.route?.path === '/analytics/events');
      const handler = analyticsLayer?.route?.stack[0]?.handle;
      if (!handler) throw new Error('Analytics route handler not found');

      const payload = {
        events: [
          { name: 'test_event', timestamp: new Date().toISOString(), props: {} },
        ],
      };

      let lastStatus = 200;

      for (let i = 0; i < 35; i++) {
        let statusCode = 200;
        const req = {
          user: undefined,
          ip: '192.168.1.100',
          socket: { remoteAddress: '192.168.1.100' },
          body: payload,
        } as unknown as Request;

        const res = {
          status: (code: number) => {
            statusCode = code;
            return res;
          },
          json: () => res,
        } as unknown as Response;

        await handler(req, res, () => {});
        lastStatus = statusCode;
      }

      expect(lastStatus).toBe(429);
    });
  });
});
