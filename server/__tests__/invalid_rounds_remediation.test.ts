import { vi, describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import express, { Request, Response } from 'express';
import http from 'http';
import * as db from '../db.js';
import * as targetGen from '../../src/shared/targetGenerator.js';
import gameRouter from '../routes/game.js';

// Mock DB and Auth
vi.mock('../db.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  isDbActive: vi.fn().mockReturnValue(true),
  setCustomQueryHandler: vi.fn(),
  setCustomTransactionHandler: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: any) => {
    req.user = {
      id: 9999,
      username: 'tester',
      firstName: 'Test',
      authDate: Math.floor(Date.now() / 1000),
    } as any;
    next();
  },
}));

vi.mock('../services/leaderboard.js', () => ({
  updateLeaderboardOnRoundSubmit: vi.fn().mockResolvedValue(true),
  getLeaderboard: vi.fn().mockResolvedValue([]),
  getRankTitle: vi.fn().mockReturnValue('Cadet'),
}));

vi.mock('../services/events.js', () => ({
  isGoldenHourActiveServer: vi.fn().mockResolvedValue({ isActive: false, multiplier: 1 }),
}));

describe('Invalid Game Rounds Security Remediation & Shadow Ban Isolation', () => {
  let app: express.Express;
  let server: http.Server;
  let serverUrl: string;
  let mockClient: any;
  let roundsDb: Map<string, any>;
  let usersDb: Map<number, any>;
  let walletsDb: Map<number, any>;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/game', gameRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  // Helper to generate macro spam click logs that trigger autoclicker anti-cheat rejection
  const createInvalidSpamLogs = () => {
    const logs: any[] = [];
    for (let i = 0; i < 30; i++) {
      logs.push({
        timestampMs: 5000 + i * 20, // 30 taps in 600ms -> 50 CPS
        xPct: 50,
        yPct: 50,
        type: 'miss',
      });
    }
    return logs;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    roundsDb = new Map();
    usersDb = new Map();
    walletsDb = new Map();

    usersDb.set(9999, { id: 9999, username: 'tester', is_banned: false, shadow_banned: false });
    walletsDb.set(9999, { user_id: 9999, stardust: 100, xp: 200, level: 1 });

    mockClient = {
      query: vi.fn().mockImplementation(async (sqlText: string, params?: any[]) => {
        const text = sqlText.trim();

        // 1. SELECT round FOR UPDATE
        if (text.includes('FROM rounds WHERE id = $1 AND user_id = $2 FOR UPDATE')) {
          const roundId = params?.[0];
          const round = roundsDb.get(roundId);
          return { rows: round ? [round] : [] };
        }

        // 2. UPDATE rounds status to rejected
        if (text.includes(`UPDATE rounds SET status = 'rejected'`)) {
          const roundId = params?.[1];
          const flags = params?.[0];
          const round = roundsDb.get(roundId);
          if (round) {
            round.status = 'rejected';
            round.flags = flags;
            round.score = 0;
          }
          return { rows: [], rowCount: 1 };
        }

        // 3. UPDATE rounds status to submitted
        if (text.includes(`status = 'submitted'`)) {
          const roundId = params?.[6];
          const score = params?.[0];
          const round = roundsDb.get(roundId);
          if (round) {
            round.status = 'submitted';
            round.score = score;
          }
          return { rows: [], rowCount: 1 };
        }

        // 4. SELECT count of rejected rounds for user
        if (text.includes(`SELECT COUNT(*) as cnt FROM rounds WHERE user_id = $1 AND status = 'rejected'`)) {
          let cnt = 0;
          for (const r of roundsDb.values()) {
            if (r.user_id === params?.[0] && r.status === 'rejected') cnt++;
          }
          return { rows: [{ cnt }] };
        }

        // 5. UPDATE users SET shadow_banned = true
        if (text.includes(`UPDATE users SET shadow_banned = true WHERE id = $1`)) {
          const u = usersDb.get(params?.[0]);
          if (u) u.shadow_banned = true;
          return { rows: [], rowCount: 1 };
        }

        // 6. SELECT shadow_banned, is_banned FROM users FOR UPDATE
        if (text.includes(`SELECT shadow_banned, is_banned FROM users WHERE id = $1 FOR UPDATE`)) {
          const u = usersDb.get(params?.[0]);
          return { rows: u ? [{ shadow_banned: u.shadow_banned, is_banned: u.is_banned }] : [] };
        }

        // 7. Wallet queries
        if (text.includes(`INSERT INTO wallets`)) {
          return { rows: [], rowCount: 1 };
        }
        if (text.includes(`SELECT stardust, xp, level FROM wallets WHERE user_id = $1 FOR UPDATE`)) {
          const w = walletsDb.get(params?.[0]);
          return { rows: w ? [w] : [] };
        }
        if (text.includes(`UPDATE wallets SET xp = $1, stardust = $2, level = $3`)) {
          const w = walletsDb.get(params?.[3]);
          if (w) {
            w.xp = params?.[0];
            w.stardust = params?.[1];
            w.level = params?.[2];
          }
          return { rows: [], rowCount: 1 };
        }

        if (text.includes(`INSERT INTO round_events`)) {
          return { rows: [], rowCount: 1 };
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    };

    vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
      return await cb(mockClient);
    });
  });

  describe('1. First Invalid Round Handling', () => {
    it('unconditionally terminates invalid round with 403 without awarding XP/Stardust', async () => {
      const roundId = 'rnd_test_invalid_1';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed: 'test_seed_alpha',
        mode: 'normal',
        status: 'issued',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const invalidClickLogs = createInvalidSpamLogs();

      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: invalidClickLogs }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.rejected).toBe(true);
      expect(data.reason).toContain('Unnatural tap frequency');

      // Round status in DB must be 'rejected'
      const savedRound = roundsDb.get(roundId);
      expect(savedRound.status).toBe('rejected');
      expect(savedRound.score).toBe(0);

      // Wallet must remain unchanged (0 XP and 0 Stardust awarded)
      const wallet = walletsDb.get(9999);
      expect(wallet.xp).toBe(200);
      expect(wallet.stardust).toBe(100);

      // User must not be shadow-banned on 1st rejection
      const user = usersDb.get(9999);
      expect(user.shadow_banned).toBe(false);
    });
  });

  describe('2. Third Rejected Round Shadow-Ban Logic', () => {
    it('sets user to shadow_banned on 3rd rejection, but still awards NO rewards and leaves round rejected', async () => {
      // Pre-seed 2 prior rejected rounds for this user
      roundsDb.set('rnd_prior_rej_1', { id: 'rnd_prior_rej_1', user_id: 9999, status: 'rejected' });
      roundsDb.set('rnd_prior_rej_2', { id: 'rnd_prior_rej_2', user_id: 9999, status: 'rejected' });

      const roundId = 'rnd_test_invalid_3';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed: 'test_seed_alpha',
        mode: 'normal',
        status: 'issued',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const invalidClickLogs = createInvalidSpamLogs();

      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: invalidClickLogs }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.rejected).toBe(true);

      // User should now be shadow-banned
      const user = usersDb.get(9999);
      expect(user.shadow_banned).toBe(true);

      // Round status must be rejected, score 0
      const savedRound = roundsDb.get(roundId);
      expect(savedRound.status).toBe('rejected');
      expect(savedRound.score).toBe(0);

      // CRITICAL: Wallet balance must NOT be altered
      const wallet = walletsDb.get(9999);
      expect(wallet.xp).toBe(200);
      expect(wallet.stardust).toBe(100);
    });
  });

  describe('3. Already Shadow-Banned User Submitting Invalid Round', () => {
    it('does NOT bypass validation or award rewards to already shadow-banned users', async () => {
      // User is already shadow-banned
      usersDb.set(9999, { id: 9999, username: 'tester', is_banned: false, shadow_banned: true });

      const roundId = 'rnd_test_shadow_banned_invalid';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed: 'test_seed_alpha',
        mode: 'normal',
        status: 'issued',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const invalidClickLogs = createInvalidSpamLogs();

      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: invalidClickLogs }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.rejected).toBe(true);

      // Round MUST remain 'rejected', NEVER updated to 'submitted'
      const savedRound = roundsDb.get(roundId);
      expect(savedRound.status).toBe('rejected');
      expect(savedRound.score).toBe(0);

      // Wallet MUST remain strictly untouched
      const wallet = walletsDb.get(9999);
      expect(wallet.xp).toBe(200);
      expect(wallet.stardust).toBe(100);
    });
  });

  describe('4. Resubmission of Rejected Round', () => {
    it('strictly denies re-submission of rejected rounds without awarding rewards or modifying balance', async () => {
      const roundId = 'rnd_already_rejected_round';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed: 'test_seed_alpha',
        mode: 'normal',
        status: 'rejected',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: [] }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.rejected).toBe(true);
      expect(data.error).toContain('already been rejected');

      // Round status must remain rejected
      const savedRound = roundsDb.get(roundId);
      expect(savedRound.status).toBe('rejected');

      // Wallet must not be modified
      const wallet = walletsDb.get(9999);
      expect(wallet.xp).toBe(200);
      expect(wallet.stardust).toBe(100);
    });
  });

  describe('5. Valid Round Submission for Normal and Shadow-Banned Users', () => {
    it('accepts legitimate round, awards rewards, and handles idempotent resubmission', async () => {
      const seed = 'test_valid_submission_seed';
      const roundId = 'rnd_valid_clean_round';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed,
        mode: 'normal',
        status: 'issued',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const targets = targetGen.generateRoundTargets(seed, 'classic');
      const validTarget = targets[0];

      const validLogs = [
        {
          timestampMs: validTarget.spawnTimeMs + 200,
          xPct: validTarget.xPct,
          yPct: validTarget.yPct,
          type: 'hit',
          targetId: validTarget.id,
        },
      ];

      // 1. First valid submission
      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: validLogs }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.confirmedScore).toBeGreaterThan(0);
      expect(data.earnedXp).toBeGreaterThan(0);
      expect(data.earnedStardust).toBeGreaterThan(0);

      // Round status is now 'submitted'
      const savedRound = roundsDb.get(roundId);
      expect(savedRound.status).toBe('submitted');
      expect(savedRound.score).toBe(data.confirmedScore);

      // Wallet is credited
      const wallet = walletsDb.get(9999);
      expect(wallet.xp).toBeGreaterThan(200);
      expect(wallet.stardust).toBeGreaterThan(100);
      const prevXp = wallet.xp;
      const prevStardust = wallet.stardust;

      // 2. Second submission (idempotent retry)
      const res2 = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: validLogs }),
      });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.alreadySubmitted).toBe(true);
      expect(data2.confirmedScore).toBe(savedRound.score);

      // Wallet MUST NOT be double-credited
      expect(wallet.xp).toBe(prevXp);
      expect(wallet.stardust).toBe(prevStardust);
    });

    it('credits legitimate round rewards to shadow-banned user but excludes them from public leaderboard', async () => {
      usersDb.set(9999, { id: 9999, username: 'tester', is_banned: false, shadow_banned: true });

      const seed = 'test_shadow_valid_seed';
      const roundId = 'rnd_valid_shadow_round';
      roundsDb.set(roundId, {
        id: roundId,
        user_id: 9999,
        seed,
        mode: 'normal',
        status: 'issued',
        started_at: new Date(Date.now() - 42000),
        score: 0,
      });

      const targets = targetGen.generateRoundTargets(seed, 'classic');
      const target = targets[0];
      const validLogs = [
        {
          timestampMs: target.spawnTimeMs + 200,
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
        },
      ];

      const leaderboardService = await import('../services/leaderboard.js');

      const res = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId, clickLogs: validLogs }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Leaderboard update MUST NOT be invoked for shadow-banned user
      expect(leaderboardService.updateLeaderboardOnRoundSubmit).not.toHaveBeenCalled();
    });
  });
});
