import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, isDbActive } from '../db.js';
import { notificationPrefsSchema } from '../validators.js';

const router = Router();

// Get notification preferences
router.get('/notifications/prefs', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId || !isDbActive()) {
    return res.json({ enabled: true, quietStart: 23, quietEnd: 8, timezone: 'UTC' });
  }

  try {
    const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
    const enabled = userRes.rows[0]?.notifications_enabled ?? true;

    const prefsRes = await query(`SELECT quiet_start, quiet_end, timezone FROM notification_prefs WHERE user_id = $1`, [userId]);
    const prefs = prefsRes.rows[0] || { quiet_start: 23, quiet_end: 8, timezone: 'UTC' };

    res.json({
      enabled,
      quietStart: prefs.quiet_start,
      quietEnd: prefs.quiet_end,
      timezone: prefs.timezone,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update notification preferences
router.post('/notifications/prefs', requireAuth, async (req: Request, res: Response) => {
  const parsed = notificationPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }
  const userId = req.user?.id;
  const { enabled, quietStart, quietEnd, timezone } = parsed.data;

  if (!userId || !isDbActive()) {
    return res.json({ success: true });
  }

  try {
    if (typeof enabled === 'boolean') {
      await query(`UPDATE users SET notifications_enabled = $1 WHERE id = $2`, [enabled, userId]);
    }

    await query(
      `INSERT INTO notification_prefs (user_id, quiet_start, quiet_end, timezone, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         quiet_start = COALESCE($2, notification_prefs.quiet_start),
         quiet_end = COALESCE($3, notification_prefs.quiet_end),
         timezone = COALESCE($4, notification_prefs.timezone),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, quietStart, quietEnd, timezone || 'UTC']
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

export default router;
