import { Router, Request, Response } from 'express';
import { query, isDbActive } from '../db.js';
import { config } from '../config.js';
import { analyticsBatchSchema } from '../validators.js';

const router = Router();

// In-memory rate limiter for anonymous analytics submission
const anonymousRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkAnonymousRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = anonymousRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    anonymousRateLimits.set(ip, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return true;
  }
  if (record.count >= 30) { // max 30 requests per min for anonymous
    return false;
  }
  record.count++;
  return true;
}

/**
 * POST /api/analytics/events
 * Batch ingest analytics events from client with strict validation & security
 */
router.post('/analytics/events', async (req: Request, res: Response) => {
  const userId = req.user?.id ? String(req.user.id) : 'anonymous';
  if (userId === 'anonymous') {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkAnonymousRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Rate limit exceeded for anonymous analytics' });
    }
  }

  const parsed = analyticsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid events batch schema', details: parsed.error.issues });
  }

  const { events } = parsed.data;

  if (isDbActive()) {
    try {
      for (const ev of events) {
        if (!ev || typeof ev !== 'object') {
          return res.status(400).json({ error: 'Invalid event object structure' });
        }

        // Validate event name
        const eventName = String(ev.name || '').trim();
        if (!eventName || eventName.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(eventName)) {
          return res.status(400).json({ error: `Invalid or disallowed event name: ${eventName}` });
        }

        // Validate timestamp (not in future, not older than 7 days)
        const now = Date.now();
        const evTime = ev.timestamp ? new Date(ev.timestamp).getTime() : now;
        if (isNaN(evTime) || evTime > now + 60000 || evTime < now - 7 * 24 * 3600 * 1000) {
          return res.status(400).json({ error: 'Invalid or out-of-bounds event timestamp' });
        }

        // Validate props size (max 4096 bytes when stringified)
        const props = ev.props && typeof ev.props === 'object' ? ev.props : {};
        const propsJson = JSON.stringify(props);
        if (propsJson.length > 4096) {
          return res.status(400).json({ error: 'Event properties size exceeds 4KB limit' });
        }

        const createdAt = new Date(evTime);
        const finalUserId = userId.substring(0, 64);

        await query(
          `INSERT INTO events (user_id, name, props, created_at) VALUES ($1, $2, $3::jsonb, $4)`,
          [finalUserId, eventName, propsJson, createdAt]
        );
      }
    } catch (err) {
      console.error('Error inserting analytics events:', err);
      // NE-07: Never return status: ok after database error!
      return res.status(500).json({ error: 'Failed to record analytics events' });
    }
  } else if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
    return res.status(503).json({ error: 'Database unavailable in production' });
  }

  return res.json({ status: 'ok', count: events.length });
});

export default router;
