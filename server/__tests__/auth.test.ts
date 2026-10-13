import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyTelegramInitData, parseInitData } from '../middleware/auth.js';
import { config, validateProductionConfig } from '../config.js';

function createValidInitData(botToken: string, authDate: number, userData: any) {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('user', JSON.stringify(userData));

  const entries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('Telegram InitData Verification & Config Security Audit Tests', () => {
  const testBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
  let originalBotToken: string;

  beforeEach(() => {
    originalBotToken = config.botToken;
    config.botToken = testBotToken;
  });

  afterEach(() => {
    config.botToken = originalBotToken;
  });

  it('rejects missing or empty initData', () => {
    const res = verifyTelegramInitData('');
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('Missing');
  });

  it('rejects invalid hash format (not 64-char hex)', () => {
    const now = Math.floor(Date.now() / 1000);
    const res = verifyTelegramInitData(`user=%7B%22id%22%3A123%7D&auth_date=${now}&hash=short_hash`);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('hash format');
  });

  it('rejects expired auth_date (older than 24 hours)', () => {
    config.botToken = testBotToken;
    const oldAuthDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const initData = createValidInitData(testBotToken, oldAuthDate, { id: 123 });
    const res = verifyTelegramInitData(initData);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('expired');
  });

  it('rejects future auth_date', () => {
    config.botToken = testBotToken;
    const futureAuthDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
    const initData = createValidInitData(testBotToken, futureAuthDate, { id: 123 });
    const res = verifyTelegramInitData(initData);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('future');
  });

  it('verifies valid initData with cyrillic, spaces, special symbols, and nested JSON', () => {
    config.botToken = testBotToken;
    const authDate = Math.floor(Date.now() / 1000);
    const complexUser = {
      id: 555444333,
      first_name: 'Пилот Тест',
      last_name: 'Звёздный Корабль #1',
      username: 'pilot_rus',
      language_code: 'ru',
      custom_data: { role: 'admin', settings: { audio: true } }
    };

    const validInitData = createValidInitData(testBotToken, authDate, complexUser);
    const res = verifyTelegramInitData(validInitData);

    expect(res.isValid).toBe(true);
    expect(res.userObj?.id).toBe(555444333);
    expect(res.userObj?.first_name).toBe('Пилот Тест');
    expect(res.userObj?.custom_data?.role).toBe('admin');
  });

  it('prohibits DEV_AUTH_BYPASS in production configuration validation', () => {
    const prodConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_value_long_enough',
      webhookSecret: 'secure_webhook_secret_value_long_enough',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: testBotToken,
      mockModeAllowed: false,
      devAuthBypass: true, // Attempting bypass in prod
    };

    expect(() => validateProductionConfig(prodConfig as any)).toThrow('DEV_AUTH_BYPASS is strictly forbidden in production');
  });

  it('rejects missing auth_date field', () => {
    config.botToken = testBotToken;
    const res = verifyTelegramInitData('user=%7B%22id%22%3A123%7D&hash=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('auth_date');
  });
});
