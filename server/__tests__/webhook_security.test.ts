import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { config } from '../config.js';

describe('Phase 3: Webhook Security Endpoints', () => {
  const app = createApp();
  const originalEnv = { ...process.env };
  const originalConfig = {
    webhookSecret: config.webhookSecret,
    botToken: config.botToken,
    nodeEnv: config.nodeEnv,
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    config.webhookSecret = originalConfig.webhookSecret;
    config.botToken = originalConfig.botToken;
    config.nodeEnv = originalConfig.nodeEnv;
  });

  it('rejects webhook requests when bot token is unconfigured', async () => {
    config.botToken = '';
    const res = await request(app)
      .post('/api/bot/webhook')
      .send({ update_id: 12345 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('BOT_TOKEN_NOT_CONFIGURED');
  });

  it('rejects webhook in production when WEBHOOK_SECRET is missing or default', async () => {
    config.botToken = '999888777:ABCDEFGHIJKLMNO_PQRSTUVWXYZabcdefghijklm';
    config.nodeEnv = 'production';
    config.webhookSecret = '';

    const res = await request(app)
      .post('/api/bot/webhook')
      .send({ update_id: 12345 });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('WEBHOOK_SECRET_NOT_CONFIGURED');
  });

  it('rejects webhook with missing secret token when secret is configured', async () => {
    config.botToken = '999888777:ABCDEFGHIJKLMNO_PQRSTUVWXYZabcdefghijklm';
    config.nodeEnv = 'production';
    config.webhookSecret = 'secure_secret_telegram_123';

    const res = await request(app)
      .post('/api/bot/webhook')
      .send({ update_id: 12345 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED_WEBHOOK_TOKEN');
  });

  it('rejects webhook with invalid secret token', async () => {
    config.botToken = '999888777:ABCDEFGHIJKLMNO_PQRSTUVWXYZabcdefghijklm';
    config.nodeEnv = 'production';
    config.webhookSecret = 'secure_secret_telegram_123';

    const res = await request(app)
      .post('/api/bot/webhook')
      .set('x-telegram-bot-api-secret-token', 'wrong_token')
      .send({ update_id: 12345 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED_WEBHOOK_TOKEN');
  });
});
