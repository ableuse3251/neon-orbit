import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Phase 2: Cron Security Endpoints', () => {
  const app = createApp();
  const originalEnv = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CRON_SECRET = originalEnv;
    } else {
      delete process.env.CRON_SECRET;
    }
  });

  it('returns 401 without auth header when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'my_secure_cron_secret_123';
    const res = await request(app).get('/api/cron/payments-reconcile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with fake x-vercel-cron header when CRON_SECRET is set', async () => {
    process.env.CRON_SECRET = 'my_secure_cron_secret_123';
    const res = await request(app)
      .get('/api/cron/payments-reconcile')
      .set('x-vercel-cron', '1');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong Bearer token', async () => {
    process.env.CRON_SECRET = 'my_secure_cron_secret_123';
    const res = await request(app)
      .get('/api/cron/payments-reconcile')
      .set('Authorization', 'Bearer wrong_token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct Bearer token', async () => {
    process.env.CRON_SECRET = 'my_secure_cron_secret_123';
    const res = await request(app)
      .get('/api/cron/payments-reconcile')
      .set('Authorization', 'Bearer my_secure_cron_secret_123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
