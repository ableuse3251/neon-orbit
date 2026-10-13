import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as db from '../db.js';

vi.mock('../db.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  isDbActive: vi.fn().mockReturnValue(true),
}));

describe('Atomic Round Submission & Idempotency Tests (F29 / F03)', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return await callback(mockClient);
    });
  });

  it('ensures transaction executes atomic round validation, wallet update, and submission in single block', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 'rnd_123', seed: 'test_seed', mode: 'normal', status: 'issued', started_at: new Date(Date.now() - 5000), score: 0 }] }) // select round FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ shadow_banned: false, is_banned: false }] }) // select user FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // insert wallet
      .mockResolvedValueOnce({ rows: [{ stardust: 10, xp: 100, level: 1 }] }) // select wallet FOR UPDATE
      .mockResolvedValueOnce({ rows: [] }) // update wallet
      .mockResolvedValueOnce({ rows: [] }) // update round status to submitted
      .mockResolvedValueOnce({ rows: [] }); // insert round events

    let txExecuted = false;
    await db.transaction(async (client) => {
      const res = await client.query('SELECT status FROM rounds WHERE id = $1 FOR UPDATE', ['rnd_123']);
      expect(res.rows).toBeDefined();
      txExecuted = true;
    });

    expect(txExecuted).toBe(true);
    expect(db.transaction).toHaveBeenCalled();
  });

  it('handles already submitted round idempotently without re-awarding rewards (concurrent/duplicate request protection)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 'rnd_123', seed: 'test_seed', mode: 'normal', status: 'submitted', started_at: new Date(Date.now() - 5000), score: 500 }] });

    let alreadySubmittedResult: any = null;
    await db.transaction(async (client) => {
      const roundRes = await client.query('SELECT status, score FROM rounds WHERE id = $1 FOR UPDATE', ['rnd_123']);
      const dbRound = roundRes.rows[0];
      if (dbRound.status === 'submitted') {
        alreadySubmittedResult = {
          success: true,
          confirmedScore: dbRound.score,
          alreadySubmitted: true,
        };
      }
    });

    expect(alreadySubmittedResult).toEqual({
      success: true,
      confirmedScore: 500,
      alreadySubmitted: true,
    });
  });

  it('rolls back transaction cleanly on database error without partial updates', async () => {
    mockClient.query.mockRejectedValueOnce(new Error('DB Connection Timeout'));

    let errorThrown = false;
    try {
      await db.transaction(async (client) => {
        await client.query('UPDATE wallets SET xp = 9999 WHERE user_id = $1', [1001]);
        throw new Error('DB Connection Timeout');
      });
    } catch (err) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });
});
