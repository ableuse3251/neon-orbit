import { describe, it, expect, vi, beforeEach } from 'vitest';
import { savePendingRound, submitRoundLogWithRetry, isRoundSubmitted, markRoundSubmitted } from '../utils/sync';
import { api } from '../utils/api';
import { RoundStats } from '../types/game';

// In-memory localStorage mock for node environment
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

vi.mock('../utils/api', () => ({
  api: {
    startRound: vi.fn(),
    submitRound: vi.fn(),
  },
}));

describe('Production Gameplay Rewards & Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const sampleServerRoundStats: RoundStats = {
    roundId: 'srnd_valid_server_12345',
    score: 1500,
    rawScore: 1500,
    totalTaps: 40,
    hits: 38,
    misses: 2,
    maxCombo: 12,
    accuracy: 95,
    minesHit: 0,
    goldenBeaconsHit: 2,
    powerupsUsed: [],
    duration: 45,
    isDailySeed: false,
    clickLogs: [],
  };

  const sampleFallbackRoundStats: RoundStats = {
    roundId: 'rnd_1728000000000',
    score: 2000,
    rawScore: 2000,
    totalTaps: 50,
    hits: 50,
    misses: 0,
    maxCombo: 20,
    accuracy: 100,
    minesHit: 0,
    goldenBeaconsHit: 3,
    powerupsUsed: [],
    duration: 45,
    isDailySeed: false,
    clickLogs: [],
  };

  const sampleDemoRoundStats: RoundStats = {
    roundId: 'demo_1728000000000',
    score: 3000,
    rawScore: 3000,
    totalTaps: 60,
    hits: 60,
    misses: 0,
    maxCombo: 25,
    accuracy: 100,
    minesHit: 0,
    goldenBeaconsHit: 5,
    powerupsUsed: [],
    duration: 45,
    isDailySeed: false,
    clickLogs: [],
  };

  describe('Start Round API 500 Error Behavior', () => {
    it('does not generate or save client fallback rnd_ IDs when server returns 500', async () => {
      vi.mocked(api.startRound).mockRejectedValue(new Error('Vercel 500 FUNCTION_INVOCATION_FAILED'));

      await expect(api.startRound({ mode: 'normal' })).rejects.toThrow('Vercel 500');

      // Verify pending queue does not contain rnd_ client fallbacks
      savePendingRound(sampleFallbackRoundStats);
      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];
      expect(pendingQueue).toHaveLength(0);
    });
  });

  describe('Submit Round API 500 Error & Pending Queue', () => {
    it('stores pending round ONLY with valid server round ID when submit API fails (500)', async () => {
      vi.mocked(api.submitRound).mockRejectedValue(new Error('Internal Server Error 500'));

      const result = await submitRoundLogWithRetry(sampleServerRoundStats);

      expect(result.success).toBe(false);

      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];

      expect(pendingQueue).toHaveLength(1);
      expect(pendingQueue[0].roundId).toBe('srnd_valid_server_12345');
    });

    it('rejects saving rnd_ or demo_ client fallbacks to pending rated queue', () => {
      savePendingRound(sampleFallbackRoundStats);
      savePendingRound(sampleDemoRoundStats);

      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];

      expect(pendingQueue).toHaveLength(0);
    });
  });

  describe('Submission Idempotency & Retry Behavior', () => {
    it('prevents duplicate reward grants upon retrying an already confirmed roundId', async () => {
      markRoundSubmitted('srnd_valid_server_12345');

      const result = await submitRoundLogWithRetry(sampleServerRoundStats);

      expect(result.success).toBe(true);
      expect(result.alreadySubmitted).toBe(true);
      expect(api.submitRound).not.toHaveBeenCalled();
    });

    it('successfully confirms pending round on retry and marks submitted', async () => {
      vi.mocked(api.submitRound).mockResolvedValue({
        success: true,
        confirmedScore: 1500,
        earnedXp: 120,
        earnedStardust: 50,
        level: 3,
        isLevelUp: false,
        rankTitle: 'Commander',
      });

      const result = await submitRoundLogWithRetry(sampleServerRoundStats);

      expect(result.success).toBe(true);
      expect(result.earnedXp).toBe(120);
      expect(result.earnedStardust).toBe(50);
      expect(isRoundSubmitted('srnd_valid_server_12345')).toBe(true);

      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];
      expect(pendingQueue).toHaveLength(0);
    });
  });

  describe('Explicit Demo Mode Isolation', () => {
    it('handles demo rounds entirely client-side without API calls or pending queue pollution', () => {
      savePendingRound(sampleDemoRoundStats);

      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];

      expect(pendingQueue).toHaveLength(0);
      expect(api.submitRound).not.toHaveBeenCalled();
    });
  });
});
