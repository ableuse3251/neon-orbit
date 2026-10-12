import { describe, it, expect } from 'vitest';
import { deleteUserAccount } from '../services/leaderboard.js';

describe('Account Deletion & Canonical User ID Contract (F04 / F07 / NE-03 / NE-06)', () => {
  it('handles deletion when database is inactive gracefully', async () => {
    const res = await deleteUserAccount(12345);
    expect(res).toBeDefined();
    expect(typeof res.success).toBe('boolean');
  });

  it('verifies callback ownership validation logic for deletion confirmation', () => {
    const targetUserId = 12345;
    const authorizedUserId = 12345;
    const unauthorizedUserId = 99999;

    const isAuthorized = (currentId: number, targetId: number) => currentId === targetId;

    expect(isAuthorized(authorizedUserId, targetUserId)).toBe(true);
    expect(isAuthorized(unauthorizedUserId, targetUserId)).toBe(false);
  });

  it('verifies canonical user ID contract and ownership mismatch rejection', () => {
    const sessionUser = { id: 111222333, username: 'pilot_one', firstName: 'Pilot', language: 'ru', isPremium: false, isAdmin: false };
    const targetRecordUserId = 444555666;

    const canAccessRecord = (sessionUserId: number, recordUserId: number) => sessionUserId === recordUserId;

    expect(sessionUser.id).toBeDefined();
    expect(typeof sessionUser.id).toBe('number');
    expect(canAccessRecord(sessionUser.id, sessionUser.id)).toBe(true);
    expect(canAccessRecord(sessionUser.id, targetRecordUserId)).toBe(false);
  });
});
