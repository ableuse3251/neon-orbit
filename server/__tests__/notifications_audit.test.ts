import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNotificationQueue, queueNotification } from '../services/notifications.js';
import * as db from '../db.js';
import { bot } from '../../bot.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    isDbActive: vi.fn(() => true),
  };
});

vi.mock('../../bot.js', () => ({
  bot: {
    api: {
      sendMessage: vi.fn(),
    },
  },
}));

describe('Notification Queue & Worker Robustness Tests (F35 / Notification Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes pending notifications successfully and logs analytics', async () => {
    vi.mocked(db.query)
      // 1. Stale processing recovery
      .mockResolvedValueOnce({ rowCount: 0 } as any)
      // 2. FOR UPDATE SKIP LOCKED claim
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 1001,
          type: 'streak_expiring',
          title: 'Streak Expiring',
          body: 'Your streak is about to expire!',
          ab_variant: 'A',
          attempts: 0,
          max_attempts: 3
        }]
      } as any)
      // 3. User prefs check
      .mockResolvedValueOnce({ rows: [{ language_code: 'en', quiet_start: 23, quiet_end: 8 }] } as any)
      // 4. Mark as sent
      .mockResolvedValueOnce({ rowCount: 1 } as any)
      // 5. Notification log insert
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    vi.mocked(bot.api.sendMessage).mockResolvedValueOnce({ message_id: 123 } as any);

    await processNotificationQueue();
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('handles Telegram 429 rate limit with retry_after backoff', async () => {
    vi.mocked(db.query)
      // 1. Stale recovery
      .mockResolvedValueOnce({ rowCount: 0 } as any)
      // 2. Claim job
      .mockResolvedValueOnce({
        rows: [{
          id: 2,
          user_id: 1002,
          type: 'event_start',
          title: 'Event',
          body: 'Event started',
          ab_variant: 'B',
          attempts: 0,
          max_attempts: 3
        }]
      } as any)
      // 3. User prefs check
      .mockResolvedValueOnce({ rows: [{ language_code: 'en' }] } as any)
      // 4. Update status on 429 error
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    const rateLimitError: any = new Error('Too Many Requests');
    rateLimitError.parameters = { retry_after: 45 };
    vi.mocked(bot.api.sendMessage).mockRejectedValueOnce(rateLimitError);

    await processNotificationQueue();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'pending'"),
      expect.arrayContaining([1, 45, expect.any(String), 2])
    );
  });

  it('moves job to dead_letter when max attempts are reached', async () => {
    vi.mocked(db.query)
      // 1. Stale recovery
      .mockResolvedValueOnce({ rowCount: 0 } as any)
      // 2. Claim job (attempts = 2, max = 3)
      .mockResolvedValueOnce({
        rows: [{
          id: 3,
          user_id: 1003,
          type: 'season_end',
          title: 'Season End',
          body: 'Season ending',
          ab_variant: 'A',
          attempts: 2,
          max_attempts: 3
        }]
      } as any)
      // 3. User prefs check
      .mockResolvedValueOnce({ rows: [{ language_code: 'en' }] } as any)
      // 4. Update status to dead_letter
      .mockResolvedValueOnce({ rowCount: 1 } as any);

    vi.mocked(bot.api.sendMessage).mockRejectedValueOnce(new Error('Network timeout'));

    await processNotificationQueue();
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'dead_letter'"),
      expect.arrayContaining([3, expect.any(String), 3])
    );
  });
});
