/**
 * Server Notification Service for Neon Orbit (F20 / NE-11 / NE-19)
 * Handles durable notification queue, atomic worker acquisition (FOR UPDATE SKIP LOCKED),
 * deduplication, retry exponential backoff, attempt limits, dead-letter tracking,
 * quiet hours, rate limiting (~25 msg/sec), Telegram 429 handling, and graceful shutdown.
 */

import { query, isDbActive } from '../db.js';
import { bot } from '../../bot.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

const APP_URL = config.appUrl || 'http://localhost:3000';

export interface NotificationPayload {
  userId: number;
  type: 'streak_expiring' | 'friend_overtook' | 'event_start' | 'season_end' | 'daily_challenge' | 'reward_ready';
  titleRu: string;
  bodyRu: string;
  titleEn: string;
  bodyEn: string;
  priority?: number; // 1 (highest) to 10 (lowest)
  scheduledFor?: Date;
}

/**
 * Queue a notification for a user with deduplication, frequency capping, and quiet hours check.
 */
export async function queueNotification(payload: NotificationPayload): Promise<boolean> {
  if (!isDbActive()) return false;

  try {
    // 1. Check if user has notifications enabled
    const userRes = await query(
      `SELECT u.notifications_enabled, p.quiet_start, p.quiet_end, p.timezone, u.language_code
       FROM users u
       LEFT JOIN notification_prefs p ON p.user_id = u.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (userRes.rows.length === 0) return false;
    const user = userRes.rows[0];

    if (user.notifications_enabled === false) {
      return false; // User opted out
    }

    // 2. Deduplication / Idempotency check: prevent duplicate pending/processing notification of same type for user
    const dupRes = await query(
      `SELECT id FROM notification_queue
       WHERE user_id = $1 AND type = $2 AND status IN ('pending', 'processing')`,
      [payload.userId, payload.type]
    );
    if (dupRes.rows.length > 0) {
      return false; // Already queued or processing
    }

    // 3. Check daily frequency cap (max 2 notifications per user per day)
    const countRes = await query(
      `SELECT COUNT(*) as cnt FROM notification_queue
       WHERE user_id = $1 AND created_at >= CURRENT_DATE AND status IN ('sent', 'pending', 'processing')`,
      [payload.userId]
    );
    const sentToday = Number(countRes.rows[0]?.cnt || 0);
    if (sentToday >= 2) {
      return false; // Frequency cap reached
    }

    // 4. Determine A/B test variant (A or B)
    const abVariant = Math.random() < 0.5 ? 'A' : 'B';

    // 5. Insert into durable queue
    await query(
      `INSERT INTO notification_queue (user_id, type, title, body, ab_variant, priority, scheduled_for, status, attempts, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 3)`,
      [
        payload.userId,
        payload.type,
        abVariant === 'A' ? payload.titleRu : payload.titleEn,
        abVariant === 'A' ? payload.bodyRu : payload.bodyEn,
        abVariant,
        payload.priority || 5,
        payload.scheduledFor || new Date(),
      ]
    );

    return true;
  } catch (err) {
    logger.error('Error queueing notification:', err);
    return false;
  }
}

/**
 * Process notification queue with atomic FOR UPDATE SKIP LOCKED worker acquisition,
 * quiet hours respect, retry exponential backoff, max attempts, dead-letter status, and Telegram 429 handling.
 */
export async function processNotificationQueue(): Promise<void> {
  if (!isDbActive()) return;

  try {
    // Recover stale processing tasks (e.g. if a worker crashed) stuck in 'processing' for > 15 minutes
    await query(`
      UPDATE notification_queue
      SET status = 'pending', scheduled_for = NOW() + INTERVAL '2 minutes', updated_at = NOW()
      WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '15 minutes'
    `);

    // Atomically claim pending jobs using FOR UPDATE SKIP LOCKED for multi-instance safety (NE-19)
    const { rows } = await query(
      `UPDATE notification_queue
       SET status = 'processing', updated_at = NOW()
       WHERE id IN (
         SELECT q.id
         FROM notification_queue q
         WHERE q.status = 'pending' AND q.scheduled_for <= NOW()
         ORDER BY q.priority ASC, q.scheduled_for ASC
         LIMIT 20
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, user_id, type, title, body, ab_variant, attempts, max_attempts`
    );

    if (rows.length === 0) return;

    for (const item of rows) {
      // Fetch user language and quiet hours prefs
      const userPrefsRes = await query(
        `SELECT u.language_code, p.quiet_start, p.quiet_end FROM users u LEFT JOIN notification_prefs p ON p.user_id = u.id WHERE u.id = $1`,
        [item.user_id]
      );
      const userPrefs = userPrefsRes.rows[0] || {};
      const currentHour = new Date().getUTCHours();
      const quietStart = userPrefs.quiet_start !== undefined && userPrefs.quiet_start !== null ? userPrefs.quiet_start : 23;
      const quietEnd = userPrefs.quiet_end !== undefined && userPrefs.quiet_end !== null ? userPrefs.quiet_end : 8;

      let inQuietHours = false;
      if (quietStart > quietEnd) {
        inQuietHours = currentHour >= quietStart || currentHour < quietEnd;
      } else {
        inQuietHours = currentHour >= quietStart && currentHour < quietEnd;
      }

      if (inQuietHours) {
        // Postpone scheduled time by 4 hours and return status to pending
        await query(
          `UPDATE notification_queue SET status = 'pending', scheduled_for = NOW() + INTERVAL '4 hours', updated_at = NOW() WHERE id = $1`,
          [item.id]
        );
        continue;
      }

      const isRu = (userPrefs.language_code || '').toLowerCase().startsWith('ru');
      const messageText = `🛸 **NEON ORBIT**\n\n**${item.title}**\n${item.body}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: isRu ? '🎮 ИГРАТЬ СЕЙЧАС' : '🎮 PLAY NOW', web_app: { url: APP_URL } }],
          [{ text: isRu ? '🔕 Отписаться' : '🔕 Unsubscribe', callback_data: `unsub_${item.user_id}` }],
        ],
      };

      try {
        await bot.api.sendMessage(item.user_id, messageText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });

        // Mark as sent
        await query(
          `UPDATE notification_queue SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [item.id]
        );

        // Log for analytics / A/B open rate tracking
        await query(
          `INSERT INTO notification_logs (user_id, type, ab_variant, sent_at) VALUES ($1, $2, $3, NOW())`,
          [item.user_id, item.type, item.ab_variant]
        );
      } catch (err: any) {
        const errStr = String(err?.message || err);
        const attempts = (item.attempts || 0) + 1;
        const maxAttempts = item.max_attempts || 3;

        // Check if user blocked bot (403, 409, blocked)
        if (errStr.includes('403') || errStr.includes('blocked') || errStr.includes('deactivated')) {
          logger.warn(`User ${item.user_id} blocked bot. Disabling notifications.`);
          await query(`UPDATE users SET notifications_enabled = FALSE WHERE id = $1`, [item.user_id]);
          await query(`UPDATE notification_queue SET status = 'failed', attempts = $1, error = $2, updated_at = NOW() WHERE id = $3`, [attempts, errStr, item.id]);
        } else if (errStr.includes('429') || errStr.includes('Too Many Requests') || err?.parameters?.retry_after) {
          // Handle Telegram 429 rate limit with retry_after backoff
          const retryAfterSec = err?.parameters?.retry_after || 60;
          logger.warn(`Telegram rate limit (429) hit for notification ${item.id}. Retrying after ${retryAfterSec}s.`);
          await query(
            `UPDATE notification_queue SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 second' * $2, error = $3, updated_at = NOW() WHERE id = $4`,
            [attempts, retryAfterSec, errStr, item.id]
          );
        } else if (attempts < maxAttempts) {
          // Exponential backoff retry: 2^attempts minutes
          const backoffMinutes = Math.pow(2, attempts);
          logger.error(`Failed to send notification to ${item.user_id} (attempt ${attempts}/${maxAttempts}). Retrying in ${backoffMinutes}m:`, errStr);
          await query(
            `UPDATE notification_queue SET status = 'pending', attempts = $1, scheduled_for = NOW() + INTERVAL '1 minute' * $2, error = $3, updated_at = NOW() WHERE id = $4`,
            [attempts, backoffMinutes, errStr, item.id]
          );
        } else {
          // Max attempts reached -> dead-letter status
          logger.error(`Notification ${item.id} permanently failed after ${maxAttempts} attempts:`, errStr);
          await query(
            `UPDATE notification_queue SET status = 'dead_letter', attempts = $1, error = $2, updated_at = NOW() WHERE id = $3`,
            [attempts, errStr, item.id]
          );
        }
      }

      // Rate limit delay ~40ms for ~25 msg/sec
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  } catch (err) {
    logger.error('Error processing notification queue:', err);
  }
}

// Background interval worker with graceful shutdown support
let workerInterval: NodeJS.Timeout | null = setInterval(() => {
  processNotificationQueue().catch((err) => logger.error('Notification queue worker error:', err));
}, 30000);

export function stopNotificationWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Notification queue worker stopped gracefully.');
  }
}
