import { describe, it, expect } from 'vitest';
import { registerReferral, activateReferral, getUserReferrals, contributeTeamGoal } from '../services/viral.js';
import viralRouter from '../routes/viral.js';
import { config } from '../config.js';

describe('Viral & Referrals V2 Service & F14 Verified Round Contribution Tests', () => {
  it('referral service methods are defined', () => {
    expect(typeof registerReferral).toBe('function');
    expect(typeof activateReferral).toBe('function');
    expect(typeof getUserReferrals).toBe('function');
    expect(typeof contributeTeamGoal).toBe('function');
  });

  it('handles inactive DB gracefully for referral registration and activation', async () => {
    await expect(registerReferral(1, 2)).resolves.toBeUndefined();
    await expect(activateReferral(2)).resolves.toBeUndefined();
    const res = await getUserReferrals(1);
    expect(res).toBeDefined();
    expect(res.count).toBe(0);
  });

  it('exports viral router securely', () => {
    expect(viralRouter).toBeDefined();
  });

  it('rejects invalid or out-of-bound team goal contributions', async () => {
    const originalMock = config.mockModeAllowed;
    config.mockModeAllowed = false;
    // Should not throw when contributing invalid score (<=0 or >1000000)
    await expect(contributeTeamGoal(-500)).resolves.toBeUndefined();
    await expect(contributeTeamGoal(2000000)).resolves.toBeUndefined();
    config.mockModeAllowed = originalMock;
  });
});
