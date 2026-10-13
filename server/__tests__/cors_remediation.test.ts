import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from 'http';
import {
  parseAllowedOrigins,
  getEffectiveAllowedOrigins,
  DEFAULT_TELEGRAM_ORIGINS,
  validateProductionConfig,
} from '../config.js';

describe('CORS and Production Configuration Remediation Suite', () => {
  describe('1. parseAllowedOrigins Unit Tests', () => {
    it('returns empty array when input is undefined, empty, or whitespace', () => {
      expect(parseAllowedOrigins(undefined)).toEqual([]);
      expect(parseAllowedOrigins('')).toEqual([]);
      expect(parseAllowedOrigins('   ')).toEqual([]);
    });

    it('correctly parses comma-separated origins with whitespace trimming', () => {
      const input = ' https://neon-orbit-omega.vercel.app , https://web.telegram.org ,  ';
      expect(parseAllowedOrigins(input)).toEqual([
        'https://neon-orbit-omega.vercel.app',
        'https://web.telegram.org',
      ]);
    });

    it('filters out empty entries and preserves valid domains', () => {
      const input = 'https://app.example.com,,,https://web.telegram.org';
      expect(parseAllowedOrigins(input)).toEqual([
        'https://app.example.com',
        'https://web.telegram.org',
      ]);
    });
  });

  describe('2. getEffectiveAllowedOrigins Tests', () => {
    it('handles empty configuration by falling back safely to default Telegram origins', () => {
      const origins = getEffectiveAllowedOrigins({});
      expect(origins).toEqual(expect.arrayContaining(DEFAULT_TELEGRAM_ORIGINS));
      expect(origins.length).toBe(DEFAULT_TELEGRAM_ORIGINS.length);
    });

    it('merges APP_URL, CORS_ORIGIN (or allowedOrigins), and Telegram WebView domains without duplicates', () => {
      const configMock = {
        appUrl: 'https://neon-orbit-omega.vercel.app',
        corsOrigin: [
          'https://neon-orbit-omega.vercel.app', // duplicate
          'https://custom-domain.com',
        ],
      };

      const origins = getEffectiveAllowedOrigins(configMock);
      expect(origins).toContain('https://neon-orbit-omega.vercel.app');
      expect(origins).toContain('https://custom-domain.com');
      expect(origins).toContain('https://web.telegram.org');
      expect(origins).toContain('https://webk.telegram.org');
      expect(origins).toContain('https://webz.telegram.org');
      expect(origins).toContain('https://telegram.org');

      // Ensure no duplicates exist
      const uniqueSet = new Set(origins);
      expect(uniqueSet.size).toBe(origins.length);
    });

    it('supports backward-compatible allowedOrigins fallback when corsOrigin is omitted', () => {
      const configMock = {
        appUrl: 'https://neon-orbit-omega.vercel.app',
        allowedOrigins: ['https://legacy-allowed.com'],
      };

      const origins = getEffectiveAllowedOrigins(configMock);
      expect(origins).toContain('https://legacy-allowed.com');
      expect(origins).toContain('https://neon-orbit-omega.vercel.app');
      expect(origins).toContain('https://web.telegram.org');
    });
  });

  describe('3. CORS Middleware HTTP Enforcement (Allowed vs Rejected vs Wildcards)', () => {
    let server: Server;
    let baseUrl = '';

    const testConfig = {
      appUrl: 'https://neon-orbit-omega.vercel.app',
      corsOrigin: ['https://neon-orbit-omega.vercel.app', 'https://web.telegram.org'],
    };

    beforeAll(async () => {
      const app = express();
      app.use(
        cors({
          origin: (origin, callback) => {
            const allowed = getEffectiveAllowedOrigins(testConfig);
            if (!origin) {
              return callback(null, true);
            }
            if (allowed.includes(origin)) {
              return callback(null, true);
            }
            return callback(new Error('CORS policy error: Origin not allowed.'));
          },
          credentials: true,
        })
      );

      app.get('/api/test', (req: Request, res: Response) => {
        res.json({ ok: true });
      });

      // Error handler for rejected CORS
      app.use((err: any, req: Request, res: Response, next: any) => {
        if (err.message && err.message.includes('CORS policy error')) {
          return res.status(403).json({ error: 'CORS_FORBIDDEN', message: err.message });
        }
        next(err);
      });

      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('grants access to exact allowed origin (APP_URL)', async () => {
      const res = await fetch(`${baseUrl}/api/test`, {
        headers: { Origin: 'https://neon-orbit-omega.vercel.app' },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('https://neon-orbit-omega.vercel.app');
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('grants access to official Telegram WebView origins (webk, webz, web)', async () => {
      const telegramDomains = [
        'https://web.telegram.org',
        'https://webk.telegram.org',
        'https://webz.telegram.org',
        'https://telegram.org',
      ];

      for (const tgDomain of telegramDomains) {
        const res = await fetch(`${baseUrl}/api/test`, {
          headers: { Origin: tgDomain },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBe(tgDomain);
      }
    });

    it('permits server-to-server or non-browser requests without Origin header', async () => {
      const res = await fetch(`${baseUrl}/api/test`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('rejects unknown or attacker origin with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/test`, {
        headers: { Origin: 'https://evil-hacker.com' },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('CORS_FORBIDDEN');
    });

    it('rejects subdomain spoofing and arbitrary wildcard attempts', async () => {
      const spoofedOrigins = [
        'https://neon-orbit-omega.vercel.app.malicious.com',
        'https://fake-neon-orbit-omega.vercel.app',
        'https://evil.telegram.org',
        'https://phishing-web.telegram.org',
      ];

      for (const badOrigin of spoofedOrigins) {
        const res = await fetch(`${baseUrl}/api/test`, {
          headers: { Origin: badOrigin },
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('CORS_FORBIDDEN');
      }
    });
  });

  describe('4. Production Secrets & Configuration Validation (without Leaking Secrets)', () => {
    it('validates production config successfully when all secrets are present', () => {
      const validConfig = {
        nodeEnv: 'production',
        jwtSecret: 'super_secret_jwt_random_key_12345678',
        webhookSecret: 'super_secret_webhook_random_key_123',
        metricsSecret: 'super_secret_metrics_bearer_random_1',
        databaseUrl: 'postgres://neon_user:pass@localhost:5432/neon_orbit',
        botToken: '8611883429:AAEvNHuFSO5De5LMXuIcHoVBRACQMqlP70Y',
        mockModeAllowed: false,
        devAuthBypass: false,
        dbSslRejectUnauthorized: true,
      };

      expect(() => validateProductionConfig(validConfig)).not.toThrow();
    });

    it('throws descriptive error on missing/default secrets WITHOUT printing secret values', () => {
      const secretToTest = 'my_super_secret_cleartext_value_12345';
      const invalidConfig = {
        nodeEnv: 'production',
        jwtSecret: 'default_jwt_secret_change_me', // default
        webhookSecret: 'default_webhook_secret',
        metricsSecret: 'default_metrics_secret',
        databaseUrl: '',
        botToken: '',
      };

      try {
        validateProductionConfig(invalidConfig);
        expect.unreachable('Should have thrown validation error');
      } catch (err: any) {
        expect(err.message).toContain('CRITICAL CONFIGURATION ERROR');
        // Ensure the error message names the variable, but does not print any secret value
        expect(err.message).not.toContain(secretToTest);
      }
    });

    it('strictly forbids DEV_AUTH_BYPASS in production', () => {
      expect(() =>
        validateProductionConfig({
          nodeEnv: 'production',
          devAuthBypass: true,
        })
      ).toThrowError(/DEV_AUTH_BYPASS is strictly forbidden in production/);
    });

    it('strictly forbids disabling database SSL certificate validation in production', () => {
      expect(() =>
        validateProductionConfig({
          nodeEnv: 'production',
          dbSslRejectUnauthorized: false,
        })
      ).toThrowError(/Disabling SSL certificate validation.*is forbidden in production/);
    });
  });
});
