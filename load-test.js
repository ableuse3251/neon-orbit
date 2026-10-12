import http from 'k6/http';
import { check, group, sleep } from 'k6';
import crypto from 'k6/crypto';

/**
 * Neon Orbit - k6 Load, Smoke & Stress Testing Suite
 *
 * Grounded strictly in actual Express routes registered in server/routes/:
 *  - GET  /api/health/liveness
 *  - GET  /api/health/readiness
 *  - GET  /api/config
 *  - GET  /api/auth/session
 *  - GET  /api/game/leaderboard
 *  - POST /api/game/round/start
 *  - POST /api/game/round/submit
 *  - POST /api/daily/claim
 *  - POST /api/shop/buy
 *  - POST /api/analytics/events
 *
 * Staging Telegram Auth:
 *  - Uses WebAppData HMAC-SHA256 signature scheme with STAGING / TEST bot token.
 *  - Zero production tokens or real user private data.
 */

// Target execution scenario via environment variable SCENARIO (default: 'load')
const SCENARIO = __ENV.SCENARIO || 'load';
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';
const BOT_TOKEN = __ENV.TELEGRAM_BOT_TOKEN || '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';

// 1. Scenario Configurations
const scenarioConfigs = {
  smoke: {
    smoke_scenario: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
  },
  load: {
    load_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Warmup ramp up to 50 VUs
        { duration: '3m', target: 200 },  // Standard target load 200 VUs
        { duration: '5m', target: 200 },  // Sustained steady load
        { duration: '1m', target: 0 },    // Ramp down / cooldown
      ],
      tags: { test_type: 'load' },
    },
  },
  stress: {
    stress_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },  // Ramp to 100 VUs
        { duration: '2m', target: 500 },  // Ramp to 500 VUs
        { duration: '3m', target: 1000 }, // High stress breaking-point (1,000 VUs)
        { duration: '1m', target: 0 },    // Cooldown
      ],
      tags: { test_type: 'stress' },
    },
  },
};

export const options = {
  scenarios: scenarioConfigs[SCENARIO] || scenarioConfigs.load,
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1000ms
    http_req_failed: ['rate<0.01'],                // Error rate must be under 1%
  },
};

/**
 * Generates valid Telegram initData for Staging / Test environments
 * without exposing production credentials or real user data.
 */
function generateStagingInitData(vuId) {
  const userId = 100000 + (vuId || 1);
  const userObj = {
    id: userId,
    first_name: `StagingVU_${userId}`,
    username: `vu_user_${userId}`,
    language_code: 'en',
  };
  const authDate = Math.floor(Date.now() / 1000);
  const userStr = JSON.stringify(userObj);
  const dataCheckString = `auth_date=${authDate}\nuser=${userStr}`;

  // HMAC SHA-256 generation using k6/crypto
  const secretKey = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash = crypto.hmac('sha256', secretKey, dataCheckString, 'hex');

  return `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
}

export default function () {
  const initData = generateStagingInitData(__VU);
  const jsonHeaders = {
    'Content-Type': 'application/json',
  };
  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': initData,
  };

  // Group 1: Infrastructure & Health Probes
  group('Health & Configuration', function () {
    const livenessRes = http.get(`${BASE_URL}/api/health/liveness`);
    check(livenessRes, {
      'liveness status is 200': (r) => r.status === 200,
      'liveness status ok': (r) => r.json() && r.json('status') === 'ok',
    });

    const readinessRes = http.get(`${BASE_URL}/api/health/readiness`);
    check(readinessRes, {
      'readiness status is 200 or 503': (r) => r.status === 200 || r.status === 503,
      'readiness has service info': (r) => r.json() && r.json('services') !== undefined,
    });

    const configRes = http.get(`${BASE_URL}/api/config`);
    check(configRes, {
      'config status is 200': (r) => r.status === 200,
      'config returns JSON body': (r) => r.json() !== null,
    });
  });

  // Group 2: Authenticated Player Lifecycle
  group('Auth & Session', function () {
    const sessionRes = http.get(`${BASE_URL}/api/auth/session`, { headers: authHeaders });
    check(sessionRes, {
      'session status is 200': (r) => r.status === 200,
      'session has valid user object': (r) => r.json() && r.json('user.id') !== undefined,
    });
  });

  // Group 3: Core Gameplay Loop
  group('Gameplay Loop', function () {
    // 1. Fetch Leaderboard
    const lbRes = http.get(`${BASE_URL}/api/game/leaderboard`, { headers: authHeaders });
    check(lbRes, {
      'leaderboard status is 200': (r) => r.status === 200,
      'leaderboard returns list': (r) => r.json() && Array.isArray(r.json('leaderboard')),
    });

    // 2. Start Game Round
    const startRes = http.post(
      `${BASE_URL}/api/game/round/start`,
      JSON.stringify({ mode: 'normal' }),
      { headers: authHeaders }
    );
    const startSuccess = check(startRes, {
      'round/start status is 200': (r) => r.status === 200,
      'round/start returns roundId': (r) => r.json() && r.json('roundId') !== undefined,
    });

    let roundId = null;
    if (startSuccess && startRes.json()) {
      roundId = startRes.json('roundId');
    }

    // 3. Submit Game Round
    if (roundId) {
      const submitPayload = JSON.stringify({
        roundId: roundId,
        clickLogs: [
          { timestampMs: 150, xPct: 45, yPct: 52, type: 'hit', targetId: 'enemy_1' },
          { timestampMs: 400, xPct: 60, yPct: 30, type: 'hit', targetId: 'enemy_2' },
          { timestampMs: 800, xPct: 55, yPct: 55, type: 'hit', targetId: 'boss_1' },
        ],
      });

      const submitRes = http.post(`${BASE_URL}/api/game/round/submit`, submitPayload, {
        headers: authHeaders,
      });

      check(submitRes, {
        'round/submit status is 200': (r) => r.status === 200,
        'round/submit returns confirmed score': (r) => r.json() && (r.json('confirmedScore') !== undefined || r.json('success') === true),
      });
    }
  });

  // Group 4: Economy & Rewards
  group('Economy Operations', function () {
    const claimRes = http.post(`${BASE_URL}/api/daily/claim`, JSON.stringify({}), {
      headers: authHeaders,
    });
    check(claimRes, {
      'daily/claim status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    });

    const buyRes = http.post(
      `${BASE_URL}/api/shop/buy`,
      JSON.stringify({ itemId: 'ship_cyber_wing' }),
      { headers: authHeaders }
    );
    check(buyRes, {
      'shop/buy status is 200 or 400': (r) => r.status === 200 || r.status === 400,
    });
  });

  // Group 5: Analytics Ingestion
  group('Analytics Event Ingestion', function () {
    const analyticsPayload = JSON.stringify({
      events: [
        {
          name: 'app_session_ping',
          timestamp: Date.now(),
          props: { vu_id: __VU, scenario: SCENARIO },
        },
      ],
    });

    const analyticsRes = http.post(`${BASE_URL}/api/analytics/events`, analyticsPayload, {
      headers: jsonHeaders,
    });

    check(analyticsRes, {
      'analytics status is 200': (r) => r.status === 200,
      'analytics received count returned': (r) => r.json() && r.json('received') !== undefined,
    });
  });

  sleep(1);
}

/**
 * Test Limitations & Staging Profile Recommendations:
 * 1. Express Rate Limiting: Default rate limiter on /api/ allows 150 req/15min per IP.
 *    In high-VU load tests, configure TRUST_PROXY / rate limiter headers or disable rate limiting on test instances.
 * 2. Database Connection Pooling: PostgreSQL connection pool size default is 20.
 *    For VUs > 500, deploy PgBouncer or scale DB pool limits on staging.
 * 3. 10,000 Virtual Users: A single node instance cannot sustain 10,000 concurrent VUs.
 *    Achieving 10,000 VUs requires horizontal pod autoscaling (5+ replicas), Redis Cluster, and dedicated DB hardware.
 *    Do not claim 10,000 VU capacity until multi-pod load testing is executed on an isolated staging cluster with results attached.
 */
