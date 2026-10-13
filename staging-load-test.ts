import http from 'http';
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import cors from 'cors';
import { config } from './server/config.js';
import healthRouter from './server/routes/health.js';
import authRouter from './server/routes/auth.js';
import gameRouter from './server/routes/game.js';
import starsRouter from './server/routes/stars.js';
import * as dbModule from './server/db.js';
import * as targetGen from './src/shared/targetGenerator.js';

interface LatencyStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  durations: number[];
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  requestsPerSecond: number;
}

const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] || process.env.SCENARIO || 'smoke';
const envTargetUrl = process.env.TARGET_URL || process.env.STAGING_URL;
const botToken = process.env.TELEGRAM_BOT_TOKEN || '123456789:STAGING_TEST_BOT_TOKEN_ABC123';

const modeConfigs = {
  smoke: { vus: 10, durationSec: 10 },
  load: { vus: 30, durationSec: 15 },
};

const modeConfig = modeConfigs[modeArg as keyof typeof modeConfigs] || modeConfigs.smoke;

function generateInitData(vuId: number): string {
  const userId = 800000 + vuId;
  const userObj = { id: userId, first_name: `VU_${vuId}`, username: `vu_${vuId}` };
  const userStr = JSON.stringify(userObj);
  const authDate = Math.floor(Date.now() / 1000);
  const dataCheckString = `auth_date=${authDate}\nuser=${userStr}`;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
}

async function executeVUWorker(targetUrl: string, vuId: number, stopTime: number, results: { durationMs: number; success: boolean }[]) {
  const initData = generateInitData(vuId);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `tma ${initData}`,
  };

  while (Date.now() < stopTime) {
    // 1. Health Probe
    const t0 = performance.now();
    try {
      const res1 = await fetch(`${targetUrl}/api/health/liveness`);
      results.push({ durationMs: performance.now() - t0, success: res1.status === 200 });
    } catch {
      results.push({ durationMs: performance.now() - t0, success: false });
    }

    // 2. Auth Session
    const t1 = performance.now();
    try {
      const res2 = await fetch(`${targetUrl}/api/auth/session`, { headers: authHeaders });
      results.push({ durationMs: performance.now() - t1, success: res2.status === 200 });
    } catch {
      results.push({ durationMs: performance.now() - t1, success: false });
    }

    // 3. Leaderboard
    const t2 = performance.now();
    try {
      const res3 = await fetch(`${targetUrl}/api/game/leaderboard`, { headers: authHeaders });
      results.push({ durationMs: performance.now() - t2, success: res3.status === 200 });
    } catch {
      results.push({ durationMs: performance.now() - t2, success: false });
    }

    // 4. Round Start
    const t3 = performance.now();
    try {
      const startRes = await fetch(`${targetUrl}/api/game/round/start`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ mode: 'normal' }),
      });
      const startData = await startRes.json();
      const startOk = startRes.status === 200 && startData.roundId;
      results.push({ durationMs: performance.now() - t3, success: !!startOk });

      if (startOk && startData.roundId) {
        const t4 = performance.now();
        const submitRes = await fetch(`${targetUrl}/api/game/round/submit`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            roundId: startData.roundId,
            score: 1500,
            clickLogs: [
              { timestampMs: 120, xPct: 40, yPct: 50, type: 'hit', targetId: 'target_a' },
              { timestampMs: 350, xPct: 60, yPct: 40, type: 'hit', targetId: 'target_b' },
            ],
          }),
        });
        results.push({ durationMs: performance.now() - t4, success: submitRes.status === 200 });
      }
    } catch {
      results.push({ durationMs: performance.now() - t3, success: false });
    }

    await new Promise((r) => setTimeout(r, 20));
  }
}

async function runStagingLoadTest() {
  let localServer: http.Server | null = null;
  let targetUrl = envTargetUrl;

  if (!targetUrl) {
    // Spin up local isolated Express server instance for load benchmarking with in-memory DB mocks
    config.botToken = botToken;
    config.nodeEnv = 'production';
    config.devAuthBypass = false;

    dbModule.setDbConnected(true);

    const roundsDb = new Map<string, any>();
    const usersDb = new Map<number, any>();

    dbModule.setCustomQueryHandler(async (sqlText: string, params?: any[]) => {
      const text = sqlText.trim();

      if (text.startsWith('INSERT INTO users')) {
        const id = params?.[0];
        usersDb.set(id, { id, username: params?.[1], first_name: params?.[2] });
        return { rows: [], rowCount: 1 } as any;
      }
      if (text.startsWith('SELECT shadow_banned')) {
        return { rows: [{ shadow_banned: false, is_banned: false }], rowCount: 1 } as any;
      }
      if (text.startsWith('SELECT stardust, xp, level FROM wallets')) {
        return { rows: [{ stardust: 150, xp: 0, level: 1 }], rowCount: 1 } as any;
      }
      if (text.startsWith('SELECT id, started_at FROM rounds WHERE user_id = $1 AND status = \'issued\'')) {
        return { rows: [], rowCount: 0 } as any;
      }
      if (text.startsWith('INSERT INTO rounds')) {
        const roundId = `round_stg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        const round = { id: roundId, user_id: params?.[0], seed: params?.[1], mode: params?.[2], status: 'issued', started_at: new Date() };
        roundsDb.set(roundId, round);
        return { rows: [round], rowCount: 1 } as any;
      }
      if (text.startsWith('SELECT id, seed, mode, status, started_at, score FROM rounds')) {
        const roundId = params?.[0];
        const r = roundsDb.get(roundId);
        return { rows: r ? [r] : [], rowCount: r ? 1 : 0 } as any;
      }
      if (text.startsWith('UPDATE rounds')) {
        const roundId = params?.[6];
        const r = roundsDb.get(roundId);
        if (r) r.status = 'submitted';
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

      return { rows: [], rowCount: 1 } as any;
    });

    dbModule.setCustomTransactionHandler(async (cb: any) => {
      return cb({ query: async (sqlText: string, params?: any[]) => (dbModule as any).query(sqlText, params) });
    });

    targetGen.setCustomRecalculateHandler(() => ({
      accepted: true,
      isValid: true,
      score: 1500,
      recalculatedScore: 1500,
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
    }));

    const app = express();
    app.use(express.json());
    app.use(cors({ origin: true, credentials: true }));

    app.use('/api', healthRouter);
    app.use('/api/auth', authRouter);
    app.use('/api', gameRouter);
    app.use('/api', starsRouter);

    app.get('/api/config', (req: Request, res: Response) => {
      res.json({ nodeEnv: 'production', botUsername: 'Neon_orbitbot', appUrl: 'https://neon-orbit-omega.vercel.app' });
    });

    await new Promise<void>((resolve) => {
      localServer = app.listen(3009, '127.0.0.1', () => {
        targetUrl = 'http://127.0.0.1:3009';
        resolve();
      });
    });
  }

  console.log(`=======================================================`);
  console.log(`🚀 NEON ORBIT STAGING LOAD TEST GENERATOR`);
  console.log(`Target URL : ${targetUrl}`);
  console.log(`Scenario   : ${modeArg.toUpperCase()}`);
  console.log(`VUs        : ${modeConfig.vus}`);
  console.log(`Duration   : ${modeConfig.durationSec}s`);
  console.log(`=======================================================`);

  const startTime = Date.now();
  const stopTime = startTime + modeConfig.durationSec * 1000;
  const results: { durationMs: number; success: boolean }[] = [];

  const workerPromises: Promise<void>[] = [];
  for (let vu = 1; vu <= modeConfig.vus; vu++) {
    workerPromises.push(executeVUWorker(targetUrl!, vu, stopTime, results));
  }

  await Promise.all(workerPromises);
  const totalTestDurationSec = (Date.now() - startTime) / 1000;

  if (localServer) {
    await new Promise<void>((r) => localServer!.close(() => r()));
  }

  const totalRequests = results.length;
  const successfulRequests = results.filter((r) => r.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const min = durations.length > 0 ? durations[0] : 0;
  const max = durations.length > 0 ? durations[durations.length - 1] : 0;
  const mean = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  const p50Index = Math.floor(durations.length * 0.5);
  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  const p50 = durations.length > 0 ? durations[p50Index] : 0;
  const p95 = durations.length > 0 ? durations[p95Index] : 0;
  const p99 = durations.length > 0 ? durations[p99Index] : 0;
  const requestsPerSecond = totalRequests / totalTestDurationSec;

  const stats: LatencyStats = {
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRate,
    durations,
    p50,
    p95,
    p99,
    min,
    max,
    mean,
    requestsPerSecond,
  };

  console.log(`\n📊 LOAD TEST RESULTS SUMMARY:`);
  console.log(`-------------------------------------------------------`);
  console.log(`Total Requests Executed : ${stats.totalRequests}`);
  console.log(`Successful Requests     : ${stats.successfulRequests}`);
  console.log(`Failed Requests         : ${stats.failedRequests}`);
  console.log(`Error Rate              : ${stats.errorRate.toFixed(2)}%`);
  console.log(`Throughput              : ${stats.requestsPerSecond.toFixed(2)} req/sec`);
  console.log(`Min Latency             : ${stats.min.toFixed(2)} ms`);
  console.log(`Mean Latency            : ${stats.mean.toFixed(2)} ms`);
  console.log(`p50 Latency             : ${stats.p50.toFixed(2)} ms`);
  console.log(`p95 Latency             : ${stats.p95.toFixed(2)} ms`);
  console.log(`p99 Latency             : ${stats.p99.toFixed(2)} ms`);
  console.log(`Max Latency             : ${stats.max.toFixed(2)} ms`);
  console.log(`-------------------------------------------------------`);

  console.log(`\n🎯 THRESHOLD VALIDATION:`);
  const p95Passed = stats.p95 < 500;
  const p99Passed = stats.p99 < 1000;
  const errorRatePassed = stats.errorRate < 1.0;

  console.log(` [${p95Passed ? 'PASS' : 'FAIL'}] Latency p95 < 500ms (Actual: ${stats.p95.toFixed(2)}ms)`);
  console.log(` [${p99Passed ? 'PASS' : 'FAIL'}] Latency p99 < 1000ms (Actual: ${stats.p99.toFixed(2)}ms)`);
  console.log(` [${errorRatePassed ? 'PASS' : 'FAIL'}] Error Rate < 1.0% (Actual: ${stats.errorRate.toFixed(2)}%)`);

  if (!p95Passed || !p99Passed || !errorRatePassed) {
    console.error(`❌ Load test thresholds failed!`);
    process.exit(1);
  } else {
    console.log(`✅ All load test thresholds passed successfully!`);
    process.exit(0);
  }
}

runStagingLoadTest().catch((err) => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});
