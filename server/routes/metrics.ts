import { Router, Request, Response } from 'express';
import { backgroundQueue } from '../services/queue.js';
import { isDbActive } from '../db.js';
import { config } from '../config.js';

const router = Router();

// In-memory metrics counters
let httpRequestsTotal = 0;
let httpRequestErrorsTotal = 0;
let paymentFailuresTotal = 0;
let activeSessionsCount = 0;

export function incrementHttpRequests() {
  httpRequestsTotal++;
}

export function incrementHttpErrors() {
  httpRequestErrorsTotal++;
}

export function incrementPaymentFailures() {
  paymentFailuresTotal++;
}

export function setActiveSessions(count: number) {
  activeSessionsCount = count;
}

router.get('/metrics', async (req: Request, res: Response) => {
  if (config.nodeEnv === 'production') {
    const metricsToken = req.headers['x-metrics-token'] || req.query.token;
    if (!metricsToken || String(metricsToken) !== String(config.webhookSecret)) {
      return res.status(403).json({ error: 'Access denied: Valid metrics token required' });
    }
  }

  const queueStatus = backgroundQueue.getQueueStatus();
  const dbStatus = isDbActive() ? 1 : 0;

  const metricsOutput = [
    `# HELP neon_orbit_http_requests_total Total HTTP requests received`,
    `# TYPE neon_orbit_http_requests_total counter`,
    `neon_orbit_http_requests_total ${httpRequestsTotal}`,
    ``,
    `# HELP neon_orbit_http_errors_total Total HTTP 5xx errors`,
    `# TYPE neon_orbit_http_errors_total counter`,
    `neon_orbit_http_errors_total ${httpRequestErrorsTotal}`,
    ``,
    `# HELP neon_orbit_payment_failures_total Total failed Telegram Stars payments`,
    `# TYPE neon_orbit_payment_failures_total counter`,
    `neon_orbit_payment_failures_total ${paymentFailuresTotal}`,
    ``,
    `# HELP neon_orbit_active_sessions Active player sessions`,
    `# TYPE neon_orbit_active_sessions gauge`,
    `neon_orbit_active_sessions ${activeSessionsCount}`,
    ``,
    `# HELP neon_orbit_queue_pending_jobs Number of pending background queue jobs`,
    `# TYPE neon_orbit_queue_pending_jobs gauge`,
    `neon_orbit_queue_pending_jobs ${queueStatus.pendingJobs}`,
    ``,
    `# HELP neon_orbit_db_connected PostgreSQL connection status (1 = connected, 0 = disconnected)`,
    `# TYPE neon_orbit_db_connected gauge`,
    `neon_orbit_db_connected ${dbStatus}`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metricsOutput);
});

export default router;
