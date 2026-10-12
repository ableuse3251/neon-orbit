import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyTelegramInitData, parseInitData } from '../middleware/auth.js';
import { config } from '../config.js';

describe('Telegram InitData Verification & Config Security (F09 / NE-08 / NE-27)', () => {
  it('rejects missing or empty initData', () => {
    const res = verifyTelegramInitData('');
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Missing');
  });

  it('rejects invalid hash format (not 64-char hex)', () => {
    const res = verifyTelegramInitData('user=%7B%22id%22%3A123%7D&auth_date=1700000000&hash=short_hash');
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('hash format');
  });

  it('rejects expired auth_date (older than 24 hours)', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const res = verifyTelegramInitData(`user=%7B%22id%22%3A123%7D&auth_date=${oldAuthDate}&hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('expired');
  });

  it('rejects future auth_date', () => {
    const futureAuthDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
    const res = verifyTelegramInitData(`user=%7B%22id%22%3A123%7D&auth_date=${futureAuthDate}&hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('future');
  });

  it('verifies valid initData with correct HMAC signature', () => {
    const botToken = config.botToken || 'test_bot_token';
    const authDate = Math.floor(Date.now() / 1000);
    const userJson = encodeURIComponent(JSON.stringify({ id: 123456, first_name: 'Test' }));
    const dataCheckString = `auth_date=${authDate}\nuser=${userJson}`;

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const validInitData = `auth_date=${authDate}&user=${userJson}&hash=${hash}`;
    const originalToken = config.botToken;
    // Temporarily set botToken for test if needed
    config.botToken = botToken;

    const res = verifyTelegramInitData(validInitData);
    expect(res.isValid).toBe(true);
    expect(res.userObj?.id).toBe(123456);
  });
});
