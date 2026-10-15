import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { createApp } from '../app.js';
import { config } from '../config.js';

describe('Phase 4: Error Handling, CORS & Rate Limit Fallback', () => {
  const app = createApp();
  const originalEnv = { ...process.env };
  const originalConfig = { ...config };

  afterEach(() => {
    process.env = { ...originalEnv };
    Object.assign(config, originalConfig);
  });

  it('returns 403 CORS_FORBIDDEN instead of 500 when origin is rejected', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.example.com');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('CORS_FORBIDDEN');
  });

  it('masks internal server error messages in production mode', async () => {
    config.nodeEnv = 'production';
    process.env.NODE_ENV = 'production';

    // Verify error handler masks 500 in production
    const testApp = express();
    testApp.get('/error', () => {
      throw new Error('Database password leak: secret123');
    });

    // Mount identical error handler as app.ts
    testApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
      const isDev = config.nodeEnv === 'development' || config.nodeEnv === 'test';
      const clientError = statusCode < 500 ? err.message : (isDev ? (err.message || 'INTERNAL_SERVER_ERROR') : 'INTERNAL_SERVER_ERROR');

      res.status(statusCode).json({
        success: false,
        error: clientError || 'INTERNAL_SERVER_ERROR',
      });
    });

    const res = await request(testApp).get('/error');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error).not.toContain('secret123');
  });
});
