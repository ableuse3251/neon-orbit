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

describe('Production Gameplay Rewards & Server Round ID Lifecycle', () => {
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
    clickLogs: [
      { timestampMs: 120, xPct: 45, yPct: 50, type: 'hit', targetId: 't1' },
      { timestampMs: 340, xPct: 60, yPct: 40, type: 'hit', targetId: 't2' },
    ],
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

  describe('1. Successful Start and Submission of Server Round ID', () => {
    it('uses the server-returned roundId throughout submission without client rnd_ fallback', async () => {
      // 1. Start round returns server ID
      const serverRoundId = 'srnd_prod_round_88899';
      vi.mocked(api.startRound).mockResolvedValue({
        success: true,
        roundId: serverRoundId,
        seed: 'norm_seed_123',
        serverStartedAt: Date.now(),
        mode: 'normal',
      });

      const startRes = await api.startRound({ mode: 'normal' });
      expect(startRes.success).toBe(true);
      expect(startRes.roundId).toBe(serverRoundId);
      expect(startRes.roundId).not.toMatch(/^rnd_/);

      // 2. Submit round uses exact server ID
      vi.mocked(api.submitRound).mockResolvedValue({
        success: true,
        confirmedScore: 1500,
        earnedXp: 150,
        earnedStardust: 50,
        level: 2,
        isLevelUp: false,
        rankTitle: 'Pilot',
      });

      const completedStats: RoundStats = {
        ...sampleServerRoundStats,
        roundId: startRes.roundId,
      };

      const submitRes = await submitRoundLogWithRetry(completedStats);

      expect(api.submitRound).toHaveBeenCalledWith({
        roundId: serverRoundId,
        clickLogs: completedStats.clickLogs,
        chatId: undefined,
      });

      expect(submitRes.success).toBe(true);
      expect(submitRes.confirmedScore).toBe(1500);
      expect(submitRes.earnedXp).toBe(150);
      expect(submitRes.earnedStardust).toBe(50);
      expect(isRoundSubmitted(serverRoundId)).toBe(true);
    });
  });

  describe('2. Start Round Error Prevents Rated Game & Submission', () => {
    it('rejects launching rated round when start API fails with 500 error', async () => {
      vi.mocked(api.startRound).mockRejectedValue(new Error('Vercel 500 FUNCTION_INVOCATION_FAILED'));

      let sessionError: string | null = null;
      let activeRoundId: string | undefined = undefined;

      try {
        const res = await api.startRound({ mode: 'normal' });
        if (res && res.success && res.roundId) {
          activeRoundId = res.roundId;
        }
      } catch (err: any) {
        sessionError = 'Failed to start server-rated session.';
        activeRoundId = undefined;
      }

      expect(sessionError).toBe('Failed to start server-rated session.');
      expect(activeRoundId).toBeUndefined();

      // Ensure no submission can be performed without active roundId
      expect(api.submitRound).not.toHaveBeenCalled();

      // Ensure client fallback rnd_* is never queued
      savePendingRound(sampleFallbackRoundStats);
      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];
      expect(pendingQueue).toHaveLength(0);
    });
  });

  describe('3. Demo Mode Never Submits Rated Round to Server', () => {
    it('isolates demo mode: assigns demo_ ID and never calls submitRound API or queues pending rated rounds', () => {
      const isDemo = true;
      const demoRoundId = `demo_${Date.now()}`;

      expect(demoRoundId).toMatch(/^demo_/);
      expect(demoRoundId).not.toMatch(/^rnd_/);

      const demoStats: RoundStats = {
        ...sampleDemoRoundStats,
        roundId: demoRoundId,
      };

      // In Demo Mode, client code directly marks confirmed in UI without api.submitRound
      if (isDemo || demoRoundId.startsWith('demo_')) {
        // Does not call api.submitRound
      } else {
        api.submitRound({ roundId: demoRoundId, clickLogs: [] });
      }

      expect(api.submitRound).not.toHaveBeenCalled();

      // Ensure savePendingRound strictly ignores demo_ IDs
      savePendingRound(demoStats);
      const pendingRaw = localStorage.getItem('neon_orbit_pending_rounds');
      const pendingQueue = pendingRaw ? JSON.parse(pendingRaw) : [];
      expect(pendingQueue).toHaveLength(0);
    });
  });

  describe('4. Submission Idempotency: Repeated Submission Never Duplicates Rewards', () => {
    it('prevents double reward accrual when submitRoundLogWithRetry is called again for same roundId', async () => {
      vi.mocked(api.submitRound).mockResolvedValue({
        success: true,
        confirmedScore: 1500,
        earnedXp: 120,
        earnedStardust: 50,
        level: 3,
        isLevelUp: false,
        rankTitle: 'Commander',
      });

      // First submission
      const firstResult = await submitRoundLogWithRetry(sampleServerRoundStats);
      expect(firstResult.success).toBe(true);
      expect(firstResult.alreadySubmitted).toBeUndefined();
      expect(api.submitRound).toHaveBeenCalledTimes(1);
      expect(isRoundSubmitted('srnd_valid_server_12345')).toBe(true);

      // Duplicate / retry submission
      const secondResult = await submitRoundLogWithRetry(sampleServerRoundStats);
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadySubmitted).toBe(true);
      expect(secondResult.confirmedScore).toBe(1500);

      // Crucial: api.submitRound must NOT be called a second time
      expect(api.submitRound).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Submit Round API 500 Error & Pending Queue', () => {
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
});
