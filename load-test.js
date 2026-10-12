import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },  // Ramp up to 1,000 users
    { duration: '1m', target: 5000 },   // Ramp up to 5,000 users
    { duration: '30s', target: 10000 }, // Peak load test at 10,000 virtual users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate must be less than 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  // Test health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
  });

  // Test leaderboards fetch (heavily cached / queried)
  const lbRes = http.get(`${BASE_URL}/api/leaderboards?limit=50`);
  check(lbRes, {
    'leaderboards status is 200': (r) => r.status === 200,
  });

  // Test catalog fetch
  const catalogRes = http.get(`${BASE_URL}/api/cosmetics/catalog`);
  check(catalogRes, {
    'catalog status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
