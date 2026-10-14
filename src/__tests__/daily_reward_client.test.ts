import { describe, it, expect, beforeEach } from 'vitest';
import { getInitialProfile, saveProfile } from '../utils/storage';
import { PlayerProfile } from '../types/game';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Client-side Daily Reward Persistence & Lock', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks isDailyRewardClaimedToday as true when lastDailyClaimDate is today', () => {
    const today = new Date().toISOString().split('T')[0];
    const profile: PlayerProfile = {
      ...getInitialProfile(),
      lastDailyClaimDate: today,
      isDailyRewardClaimedToday: true,
      streakDays: 3,
      stardust: 300,
    };
    saveProfile(profile);

    const reloaded = getInitialProfile();
    expect(reloaded.isDailyRewardClaimedToday).toBe(true);
    expect(reloaded.lastDailyClaimDate).toBe(today);
    expect(reloaded.streakDays).toBe(3);
  });

  it('marks isDailyRewardClaimedToday as false when lastDailyClaimDate was yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const profile: PlayerProfile = {
      ...getInitialProfile(),
      lastDailyClaimDate: yesterday,
      isDailyRewardClaimedToday: true, // was true yesterday
      streakDays: 2,
    };
    saveProfile(profile);

    const reloaded = getInitialProfile();
    // Because a new day has arrived, isDailyRewardClaimedToday must reset to false
    expect(reloaded.isDailyRewardClaimedToday).toBe(false);
    expect(reloaded.lastDailyClaimDate).toBe(yesterday);
    expect(reloaded.streakDays).toBe(2);
  });
});
