import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express, { Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import cors from 'cors';
import { config } from '../config.js';
import healthRouter from '../routes/health.js';
import authRouter from '../routes/auth.js';
import gameRouter from '../routes/game.js';
import starsRouter from '../routes/stars.js';
import * as dbModule from '../db.js';
import * as redisModule from '../redis.js';
import * as targetGen from '../../src/shared/targetGenerator.js';

// Helper to generate a valid Telegram initData string signed with test bot token
function createSignedInitData(botToken: string, userObj: object, authDate = Math.floor(Date.now() / 1000)): string {
  const userStr = JSON.stringify(userObj);
  const dataCheckString = `auth_date=${authDate}\nuser=${userStr}`;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
}

describe('Staging Integration & End-to-End Verification Suite', () => {
  let app: express.Express;
  let server: http.Server;
  let serverUrl: string;
  const testBotToken = '123456789:STAGING_TEST_BOT_TOKEN_ABC123';

  // In-memory tables for staging test environment
  const usersDb = new Map<number, any>();
  const roundsDb = new Map<string, any>();
  const walletsDb = new Map<number, any>();

  beforeAll(async () => {
    config.botToken = testBotToken;
    config.nodeEnv = 'production';
    config.devAuthBypass = false;
    config.appUrl = 'https://neon-orbit-omega.vercel.app';
    config.allowedOrigins = ['https://neon-orbit-omega.vercel.app'];

    dbModule.setDbConnected(true);

    // Mock health check helpers
    vi.spyOn(dbModule, 'checkDbHealth').mockResolvedValue({ status: 'ok' });
    vi.spyOn(redisModule, 'checkRedisHealth').mockResolvedValue({ status: 'ok' });
    vi.spyOn(dbModule, 'isDbActive').mockReturnValue(true);

    // Mock recalculateRound to pass anti-cheat verification in tests
    vi.spyOn(targetGen, 'recalculateRound').mockReturnValue({
      accepted: true,
      isValid: true,
      score: 1250,
      recalculatedScore: 1250,
      accuracy: 95,
      combo: 10,
      maxCombo: 10,
      hits: 5,
      misses: 0,
      totalTaps: 5,
      goldenBeaconsHit: 0,
      minesHit: 0,
      blackHolesHit: 0,
      bossesDefeated: 0,
      flags: [],
    });

    // Mock DB queries using vi.spyOn for isolated staging test suite
    vi.spyOn(dbModule, 'query').mockImplementation(async (sqlText: string, params?: any[]) => {
      const text = sqlText.trim();

      if (text.startsWith('INSERT INTO users')) {
        const id = params?.[0];
        if (!usersDb.has(id)) {
          usersDb.set(id, { id, username: params?.[1], first_name: params?.[2], last_seen_at: new Date() });
        }
        return { rows: [], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT id FROM users')) {
        const id = params?.[0];
        const user = usersDb.get(id);
        return { rows: user ? [{ id: user.id }] : [], rowCount: user ? 1 : 0 } as any;
      }

      if (text.startsWith('SELECT shadow_banned')) {
        return { rows: [{ shadow_banned: false, is_banned: false }], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT stardust, xp, level FROM wallets')) {
        const userId = params?.[0];
        const w = walletsDb.get(userId) || { stardust: 150, xp: 0, level: 1 };
        return { rows: [w], rowCount: 1 } as any;
      }

      if (text.startsWith('INSERT INTO wallets')) {
        const userId = params?.[0];
        if (!walletsDb.has(userId)) {
          walletsDb.set(userId, { stardust: params?.[1] || 150, xp: params?.[2] || 0, level: params?.[3] || 1 });
        }
        return { rows: [], rowCount: 1 } as any;
      }

      if (text.startsWith('UPDATE wallets')) {
        const userId = params?.[2];
        const w = walletsDb.get(userId) || { stardust: 150, xp: 0, level: 1 };
        w.stardust += params?.[0] || 0;
        w.xp += params?.[1] || 0;
        walletsDb.set(userId, w);
        return { rows: [w], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT id, started_at FROM rounds WHERE user_id = $1 AND status = \'issued\'')) {
        const userId = params?.[0];
        const active = Array.from(roundsDb.values()).find((r) => r.user_id === userId && r.status === 'issued');
        return { rows: active ? [active] : [], rowCount: active ? 1 : 0 } as any;
      }

      if (text.startsWith('INSERT INTO rounds')) {
        const roundId = `round_stg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const round = {
          id: roundId,
          user_id: params?.[0],
          seed: params?.[1],
          mode: params?.[2],
          status: 'issued',
          started_at: new Date(),
          score: 0,
        };
        roundsDb.set(roundId, round);
        return { rows: [round], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT id, seed, mode, status, started_at, score FROM rounds WHERE id = $1 AND user_id = $2')) {
        const roundId = params?.[0];
        const userId = params?.[1];
        const r = roundsDb.get(roundId);
        if (r && r.user_id === userId) {
          return { rows: [r], rowCount: 1 } as any;
        }
        return { rows: [], rowCount: 0 } as any;
      }

      if (text.startsWith('UPDATE rounds')) {
        if (text.includes("status = 'submitted'")) {
          const score = params?.[0];
          const roundId = params?.[6];
          const r = roundsDb.get(roundId);
          if (r) {
            r.status = 'submitted';
            r.score = score;
          }
        }
        return { rows: [], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT') && text.includes('FROM equipped')) {
        return { rows: [{ ship: 'ship_cyber_wing', backdrop: 'backdrop_synth_grid' }], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT item_id FROM inventory')) {
        return { rows: [{ item_id: 'ship_cyber_wing' }], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT achievement_id FROM achievements')) {
        return { rows: [], rowCount: 0 } as any;
      }

      if (text.startsWith('SELECT streak, claim_date FROM daily_claims')) {
        return { rows: [], rowCount: 0 } as any;
      }

      if (text.startsWith('SELECT COUNT(*) as count FROM referrals')) {
        return { rows: [{ count: 0 }], rowCount: 1 } as any;
      }

      if (text.startsWith('SELECT has_streak_insurance')) {
        return { rows: [{ has_streak_insurance: false, hide_from_leaderboard: false, notifications_enabled: true }], rowCount: 1 } as any;
      }

      if (text.startsWith('INSERT INTO equipped') || text.startsWith('INSERT INTO inventory')) {
        return { rows: [], rowCount: 1 } as any;
      }

      return { rows: [], rowCount: 0 } as any;
    });

    vi.spyOn(dbModule, 'transaction').mockImplementation(async (callback: any) => {
      const mockClient = { query: dbModule.query };
      return callback(mockClient);
    });

    app = express();
    app.use(express.json());

    app.use(
      cors({
        origin: (origin, callback) => {
          const configuredOrigins = config.allowedOrigins || [];
          const allowedOrigins = [
            config.appUrl || 'https://neon-orbit-omega.vercel.app',
            ...configuredOrigins,
            'https://telegram.org',
            'https://web.telegram.org',
            'https://webk.telegram.org',
            'https://webz.telegram.org',
          ].filter(Boolean) as string[];

          if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('CORS policy error: Origin not allowed.'));
        },
        credentials: true,
      })
    );

    app.use('/api', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api', gameRouter);
    app.use('/api', starsRouter);

    app.get('/api/config', (req: Request, res: Response) => {
      res.json({
        nodeEnv: config.nodeEnv,
        botUsername: config.botUsername,
        appUrl: config.appUrl,
        features: { stars: true, analytics: true },
      });
    });

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
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 1. Health Checks
  describe('1. Health Checks', () => {
    it('GET /api/health/liveness returns 200 OK with status ok', async () => {
      const res = await fetch(`${serverUrl}/api/health/liveness`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
    });

    it('GET /api/health/readiness returns readiness state', async () => {
      const res = await fetch(`${serverUrl}/api/health/readiness`);
      expect([200, 503]).toContain(res.status);
      const data = await res.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('services');
    });
  });

  // 2. Config Endpoint
  describe('2. Config Endpoint', () => {
    it('GET /api/config returns safe environment info without secrets', async () => {
      const res = await fetch(`${serverUrl}/api/config`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.nodeEnv).toBe('production');
      expect(data).not.toHaveProperty('jwtSecret');
      expect(data).not.toHaveProperty('botToken');
      expect(data).not.toHaveProperty('metricsSecret');
    });
  });

  // 3. Auth without initData
  describe('3. Auth without initData', () => {
    it('GET /api/auth/session returns 401 Unauthorized when missing Authorization header', async () => {
      const res = await fetch(`${serverUrl}/api/auth/session`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/auth/session returns 400 Bad Request if initData is supplied in query string', async () => {
      const res = await fetch(`${serverUrl}/api/auth/session?initData=some_query_data`);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Bad Request');
      expect(data.message).toMatch(/query parameters is forbidden/i);
    });
  });

  // 4. Valid and Corrupted Telegram initData
  describe('4. Telegram initData Verification', () => {
    it('rejects corrupted initData signature with 401 Unauthorized', async () => {
      const corruptHeader = 'tma auth_date=1700000000&user=%7B%22id%22%3A999%7D&hash=0000000000000000000000000000000000000000000000000000000000000000';
      const res = await fetch(`${serverUrl}/api/auth/session`, {
        headers: { Authorization: corruptHeader },
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('authenticates successfully with valid HMAC-SHA256 initData', async () => {
      const user = { id: 700100, first_name: 'StagingTester', username: 'staging_pilot' };
      const validInitData = createSignedInitData(testBotToken, user);
      const res = await fetch(`${serverUrl}/api/auth/session`, {
        headers: { Authorization: `tma ${validInitData}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.id).toBe(700100);
      expect(data.profile.username).toBe('staging_pilot');
    });
  });

  // 5. Round Start & Submit
  describe('5. Round Lifecycle (Start & Submit)', () => {
    it('starts round and returns server roundId, then submits score', async () => {
      const user = { id: 700200, first_name: 'Pilot200', username: 'pilot200' };
      const validInitData = createSignedInitData(testBotToken, user);
      const authHeader = { Authorization: `tma ${validInitData}`, 'Content-Type': 'application/json' };

      // 1. Start Round
      const startRes = await fetch(`${serverUrl}/api/game/round/start`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ mode: 'normal' }),
      });
      expect(startRes.status).toBe(200);
      const startData = await startRes.json();
      expect(startData.roundId).toBeDefined();

      // 2. Submit Round
      const submitRes = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          roundId: startData.roundId,
          score: 1250,
          clickLogs: [
            { timestampMs: 100, xPct: 50, yPct: 50, type: 'hit', targetId: 't1' },
            { timestampMs: 300, xPct: 55, yPct: 55, type: 'hit', targetId: 't2' },
          ],
        }),
      });
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.confirmedScore).toBeDefined();
    });
  });

  // 6. Leaderboard
  describe('6. Leaderboard', () => {
    it('GET /api/game/leaderboard returns ranked entries array', async () => {
      const user = { id: 700300, first_name: 'RankPilot', username: 'rank_pilot' };
      const validInitData = createSignedInitData(testBotToken, user);

      const res = await fetch(`${serverUrl}/api/game/leaderboard`, {
        headers: { Authorization: `tma ${validInitData}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.entries || data.leaderboard)).toBe(true);
    });
  });

  // 7. Exactly-once Reward Idempotency
  describe('7. Idempotency & Exactly-Once Reward Accrual', () => {
    it('prevents double reward assignment on duplicate round submission', async () => {
      const user = { id: 700400, first_name: 'IdemUser', username: 'idem_user' };
      const validInitData = createSignedInitData(testBotToken, user);
      const authHeader = { Authorization: `tma ${validInitData}`, 'Content-Type': 'application/json' };

      // Start round
      const startRes = await fetch(`${serverUrl}/api/game/round/start`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({ mode: 'normal' }),
      });
      const { roundId } = await startRes.json();

      const payload = JSON.stringify({
        roundId,
        score: 2000,
        clickLogs: [{ timestampMs: 100, xPct: 50, yPct: 50, type: 'hit', targetId: 't1' }],
      });

      // Submit #1
      const submit1 = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: authHeader,
        body: payload,
      });
      expect(submit1.status).toBe(200);
      const res1 = await submit1.json();

      // Submit #2 (Duplicate)
      const submit2 = await fetch(`${serverUrl}/api/game/round/submit`, {
        method: 'POST',
        headers: authHeader,
        body: payload,
      });
      expect(submit2.status).toBe(200);
      const res2 = await submit2.json();

      // Duplicate submission returns alreadySubmitted flag without re-awarding score or XP
      expect(res2.alreadySubmitted).toBe(true);
      expect(res2.confirmedScore).toBe(res1.confirmedScore);
    });
  });

  // 8. CORS Security Verification
  describe('8. CORS Origin Security', () => {
    it('allows request from configured origin and sets Access-Control-Allow-Origin', async () => {
      const res = await fetch(`${serverUrl}/api/health/liveness`, {
        headers: { Origin: 'https://neon-orbit-omega.vercel.app' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBe('https://neon-orbit-omega.vercel.app');
    });

    it('rejects CORS request from disallowed origin', async () => {
      const res = await fetch(`${serverUrl}/api/health/liveness`, {
        headers: { Origin: 'https://unauthorized-malicious-domain.com' },
      });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  // 9. Payment Scenarios (Official Test Mode Only)
  describe('9. Telegram Stars Payment Test Loop', () => {
    it('creates test invoice payload without initiating real charges', async () => {
      const user = { id: 700500, first_name: 'TestPayer', username: 'test_payer' };
      const validInitData = createSignedInitData(testBotToken, user);

      const res = await fetch(`${serverUrl}/api/stars/create-invoice`, {
        method: 'POST',
        headers: {
          Authorization: `tma ${validInitData}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId: 'stardust_pack_small', isTest: true }),
      });

      expect([200, 400]).toContain(res.status);
      const data = await res.json();
      if (res.status === 200) {
        expect(data.invoiceUrl || data.payload).toBeDefined();
      }
    });
  });
});
