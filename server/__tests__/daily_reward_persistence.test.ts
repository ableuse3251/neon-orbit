import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import economyRouter, { clearMockDailyClaims } from '../routes/economy.js';
import authRouter from '../routes/auth.js';
import * as db from '../db.js';

describe('Daily Reward Once-Per-Day Persistence & Locking Tests', () => {
  let app: express.Express;
  let server: http.Server;
  let serverUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    // Mock user auth
    app.use((req, _res, next) => {
      (req as any).user = {
        id: 888777666,
        username: 'daily_tester',
        firstName: 'DailyTester',
        language: 'ru',
        isPremium: false,
        isAdmin: false,
      };
      next();
    });
    app.use('/api', economyRouter);
    app.use('/api/auth', authRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        serverUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearMockDailyClaims();
    db.setPool(null);
  });

  describe('1. Mock / Fallback Mode (No DB)', () => {
    beforeEach(() => {
      vi.spyOn(db, 'isDbActive').mockReturnValue(false);
    });

    it('first daily claim succeeds, records claim date, and locks further claims for today', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Initial status before claim
      const statusRes1 = await fetch(`${serverUrl}/api/daily/claim/status`);
      expect(statusRes1.status).toBe(200);
      const statusData1 = await statusRes1.json();
      expect(statusData1.claimedToday).toBe(false);
      expect(statusData1.canClaim).toBe(true);

      // Claim #1: Should succeed
      const claimRes1 = await fetch(`${serverUrl}/api/daily/claim`, { method: 'POST' });
      expect(claimRes1.status).toBe(200);
      const claimData1 = await claimRes1.json();
      expect(claimData1.success).toBe(true);
      expect(claimData1.claimedToday).toBe(true);
      expect(claimData1.canClaim).toBe(false);
      expect(claimData1.lastClaimDate).toBe(today);
      expect(claimData1.streak).toBe(1);

      // Status check after claim: Must be claimedToday = true, canClaim = false
      const statusRes2 = await fetch(`${serverUrl}/api/daily/claim/status`);
      expect(statusRes2.status).toBe(200);
      const statusData2 = await statusRes2.json();
      expect(statusData2.claimedToday).toBe(true);
      expect(statusData2.canClaim).toBe(false);

      // Claim #2: Immediate retry on the same day MUST be rejected with 400 ALREADY_CLAIMED
      const claimRes2 = await fetch(`${serverUrl}/api/daily/claim`, { method: 'POST' });
      expect(claimRes2.status).toBe(400);
      const claimData2 = await claimRes2.json();
      expect(claimData2.success).toBe(false);
      expect(claimData2.error).toBe('ALREADY_CLAIMED');
      expect(claimData2.claimedToday).toBe(true);
      expect(claimData2.canClaim).toBe(false);

      // Session endpoint must also report claimedToday = true
      const sessionRes = await fetch(`${serverUrl}/api/auth/session`);
      expect(sessionRes.status).toBe(200);
      const sessionData = await sessionRes.json();
      expect(sessionData.dailyClaimStreak.claimedToday).toBe(true);
      expect(sessionData.dailyClaimStreak.canClaim).toBe(false);
    });
  });

  describe('2. PostgreSQL Database Transaction Mode', () => {
    it('executes database queries with row locking and rejects duplicate claims', async () => {
      const today = new Date().toISOString().split('T')[0];

      vi.spyOn(db, 'isDbActive').mockReturnValue(true);
      db.setPool({ query: vi.fn(), connect: vi.fn() } as any);

      const mockClient = {
        query: vi.fn()
          // 1. SELECT has_streak_insurance
          .mockResolvedValueOnce({ rows: [{ has_streak_insurance: false }] })
          // 2. Check if already claimed today -> empty (not claimed yet)
          .mockResolvedValueOnce({ rows: [] })
          // 3. SELECT last claim -> empty
          .mockResolvedValueOnce({ rows: [] })
          // 4. INSERT INTO daily_claims
          .mockResolvedValueOnce({ rowCount: 1 })
          // 5. UPDATE wallets
          .mockResolvedValueOnce({ rowCount: 1 })
      };

      vi.spyOn(db, 'transaction').mockImplementationOnce(async (cb: any) => {
        return await cb(mockClient);
      });

      // Claim #1: Success
      const res1 = await fetch(`${serverUrl}/api/daily/claim`, { method: 'POST' });
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.claimedToday).toBe(true);
      expect(data1.canClaim).toBe(false);
      expect(data1.streak).toBe(1);

      // Verify queries executed
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT 1 FROM daily_claims WHERE user_id = $1 AND claim_date = $2 FOR UPDATE',
        [888777666, today]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO daily_claims (user_id, claim_date, streak) VALUES ($1, $2, $3)',
        [888777666, today, 1]
      );

      // Claim #2: DB check finds existing row for today -> throws ALREADY_CLAIMED
      const mockClient2 = {
        query: vi.fn()
          // 1. SELECT has_streak_insurance
          .mockResolvedValueOnce({ rows: [{ has_streak_insurance: false }] })
          // 2. Check if already claimed today -> returns 1 row (ALREADY CLAIMED)
          .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
      };

      vi.spyOn(db, 'transaction').mockImplementationOnce(async (cb: any) => {
        return await cb(mockClient2);
      });

      const res2 = await fetch(`${serverUrl}/api/daily/claim`, { method: 'POST' });
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.success).toBe(false);
      expect(data2.error).toBe('ALREADY_CLAIMED');
      expect(data2.claimedToday).toBe(true);
      expect(data2.canClaim).toBe(false);
    });
  });
});
