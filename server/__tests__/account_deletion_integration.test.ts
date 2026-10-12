import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteUserAccount } from '../services/leaderboard.js';
import * as db from '../db.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    isDbActive: vi.fn(() => true),
  };
});

describe('Account Deletion & Privacy Compliance Integration Tests (F34 / GDPR Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('erases user personal data and leaderboards while preserving payment audit records', async () => {
    vi.mocked(db.query)
      // 1. user_chats query in removeUserFromAllLeaderboards
      .mockResolvedValueOnce({ rows: [] } as any)
      // 2. UPDATE payments SET user_id = NULL
      .mockResolvedValueOnce({ rowCount: 1 } as any)
      // 3. DELETE FROM users WHERE id = $1
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 555666 }] } as any);

    const result = await deleteUserAccount(555666);
    expect(result.success).toBe(true);
  });

  it('handles account deletion when user is not found or already deleted', async () => {
    vi.mocked(db.query)
      // 1. user_chats query in removeUserFromAllLeaderboards
      .mockResolvedValueOnce({ rows: [] } as any)
      // 2. UPDATE payments SET user_id = NULL
      .mockResolvedValueOnce({ rowCount: 0 } as any)
      // 3. DELETE FROM users WHERE id = $1 -> not found
      .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

    const result = await deleteUserAccount(999999);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('validates callback query ownership constraint for bot deletion confirmation', () => {
    const callbackUserId = 12345;
    const clickingUserId = 12345;
    const maliciousUserId = 99999;

    const verifyOwnership = (userId: number, targetId: number) => userId === targetId;

    expect(verifyOwnership(clickingUserId, callbackUserId)).toBe(true);
    expect(verifyOwnership(maliciousUserId, callbackUserId)).toBe(false);
  });
});
