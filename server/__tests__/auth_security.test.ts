import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyTelegramInitData, requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { config } from '../config.js';
import { Request, Response } from 'express';

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

describe('Telegram Auth & Admin Security Audit Tests (F32 / Auth & RBAC)', () => {
  const testBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
  let originalBotToken: string;
  let originalAdminIds: string[];

  beforeEach(() => {
    originalBotToken = config.botToken;
    originalAdminIds = [...config.adminTelegramIds];
  });

  afterEach(() => {
    config.botToken = originalBotToken;
    config.adminTelegramIds = originalAdminIds;
  });

  it('verifies a valid Telegram initData signature', () => {
    config.botToken = testBotToken;
    const authDate = Math.floor(Date.now() / 1000);
    const validInitData = createValidInitData(testBotToken, authDate, { id: 987654, username: 'secure_pilot', first_name: 'Secure' });
    const result = verifyTelegramInitData(validInitData);

    expect(result.isValid).toBe(true);
    expect(result.userObj?.id).toBe(987654);
    expect(result.userObj?.username).toBe('secure_pilot');
  });

  it('rejects tampered user data (signature mismatch)', () => {
    config.botToken = testBotToken;
    const authDate = Math.floor(Date.now() / 1000);
    const validInitData = createValidInitData(testBotToken, authDate, { id: 987654, username: 'secure_pilot' });
    // Tamper by replacing user payload in query string without re-signing
    const tamperedUser = encodeURIComponent(JSON.stringify({ id: 111111, username: 'attacker' }));
    const maliciousInitData = validInitData.replace(/user=[^&]+/, `user=${tamperedUser}`);
    const result = verifyTelegramInitData(maliciousInitData);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('HMAC signature mismatch');
  });

  it('rejects expired initData (> 24 hours old)', () => {
    config.botToken = testBotToken;
    const expiredAuthDate = Math.floor(Date.now() / 1000) - 90000; // 25 hours ago
    const expiredInitData = createValidInitData(testBotToken, expiredAuthDate, { id: 987654 });
    const result = verifyTelegramInitData(expiredInitData);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('rejects future auth_date with tolerance check', () => {
    config.botToken = testBotToken;
    const futureAuthDate = Math.floor(Date.now() / 1000) + 1000; // 1000s in future
    const futureInitData = createValidInitData(testBotToken, futureAuthDate, { id: 987654 });
    const result = verifyTelegramInitData(futureInitData);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('in the future');
  });

  it('handles repeated or duplicate parameters securely', () => {
    config.botToken = testBotToken;
    const authDate = Math.floor(Date.now() / 1000);
    const userJson = JSON.stringify({ id: 987654 });
    const badInitData = `auth_date=${authDate}&auth_date=${authDate}&user=${userJson}&hash=invalidhash`;
    const result = verifyTelegramInitData(badInitData);
    expect(result.isValid).toBe(false);
  });

  it('blocks unauthorized users from accessing admin endpoints (RBAC 403)', () => {
    let statusSet = 0;
    let jsonCalled: any = null;

    const mockReq = {
      user: {
        id: 777888999, // Non-admin ID
        isAdmin: false,
      },
    } as unknown as Request;

    const mockRes = {
      status: (code: number) => {
        statusSet = code;
        return {
          json: (data: any) => {
            jsonCalled = data;
          },
        };
      },
    } as unknown as Response;

    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    requireAdmin(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusSet).toBe(403);
    expect(jsonCalled?.error).toContain('Access denied');
  });
});
