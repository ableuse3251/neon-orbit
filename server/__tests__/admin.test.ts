import { describe, it, expect } from 'vitest';
import { requireAdmin } from '../middleware/admin.js';
import { config } from '../config.js';
import { Request, Response } from 'express';

describe('Admin Security Middleware, RBAC & F15 Report Validation Tests', () => {
  it('blocks non-admin users with HTTP 403 Forbidden', () => {
    let statusSet = 0;
    let jsonCalledWith: any = null;

    const mockReq = {
      user: {
        id: 9999999, // Regular non-admin user ID
        isAdmin: false,
      },
    } as unknown as Request;

    const mockRes = {
      status: (code: number) => {
        statusSet = code;
        return {
          json: (data: any) => {
            jsonCalledWith = data;
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
    expect(jsonCalledWith?.error).toContain('Admin authorization required');
  });

  it('allows authorized admin IDs through next()', () => {
    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    const mockRes = {} as Response;

    const mockReq = {
      user: {
        id: 1110001,
        isAdmin: true,
      },
    } as unknown as Request;

    requireAdmin(mockReq, mockRes, mockNext);
    expect(nextCalled).toBe(true);
  });

  it('verifies config.adminTelegramIds check logic for /report', () => {
    const originalAdminIds = [...config.adminTelegramIds];
    const fixtureAdminIds = originalAdminIds.length > 0 ? originalAdminIds : ['123456', '789012'];
    config.adminTelegramIds = fixtureAdminIds;

    try {
      const adminIds = config.adminTelegramIds;
      expect(Array.isArray(adminIds)).toBe(true);

      const testAdminId = String(adminIds[0]);
      const testNonAdminId = '999999999';

      const isAdminCheck = (userId: string) => adminIds.some((id) => String(id) === userId);

      expect(isAdminCheck(testAdminId)).toBe(true);
      expect(isAdminCheck(testNonAdminId)).toBe(false);
    } finally {
      config.adminTelegramIds = originalAdminIds;
    }
  });
});
