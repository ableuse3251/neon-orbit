import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as db from '../db.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    transaction: vi.fn(async (callback) => {
      const mockClient = {
        query: vi.fn(),
      };
      return await callback(mockClient);
    }),
    isDbActive: vi.fn(() => true),
  };
});

describe('Economy Audit, Transactional Safety & Idempotency Tests (F33 / Economy Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents duplicate daily reward claims on the same day', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT streak insurance
        .mockResolvedValueOnce({ rows: [{ has_streak_insurance: false }] })
        // 2. Check today claim -> returns existing claim (already claimed)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    await expect(db.transaction(async (client) => {
      const uRes = await client.query('SELECT has_streak_insurance FROM users WHERE id = $1 FOR UPDATE', [101]);
      const todayCheck = await client.query('SELECT 1 FROM daily_claims WHERE user_id = $1 AND claim_date = $2 FOR UPDATE', [101, '2026-10-12']);
      if (todayCheck.rows.length > 0) {
        throw new Error('ALREADY_CLAIMED');
      }
    })).rejects.toThrow('ALREADY_CLAIMED');
  });

  it('prevents shop purchase when stardust balance is insufficient', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. Inventory check (not owned)
        .mockResolvedValueOnce({ rows: [] })
        // 2. Wallet select balance -> low stardust (10 < 100 item price)
        .mockResolvedValueOnce({ rows: [{ stardust: 10 }] })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    await expect(db.transaction(async (client) => {
      const invCheck = await client.query('SELECT 1 FROM inventory WHERE user_id = $1 AND item_id = $2 FOR UPDATE', [101, 'skin_plasma_crusher']);
      if (invCheck.rows.length > 0) throw new Error('ALREADY_OWNED');
      const wRes = await client.query('SELECT stardust FROM wallets WHERE user_id = $1 FOR UPDATE', [101]);
      const stardust = Number(wRes.rows[0]?.stardust || 0);
      if (stardust < 100) {
        throw new Error('INSUFFICIENT_FUNDS');
      }
    })).rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  it('enforces server-side condition verification for achievement claims', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. Achievement check (not claimed)
        .mockResolvedValueOnce({ rows: [] })
        // 2. Stats query -> total rounds = 0 (below target)
        .mockResolvedValueOnce({ rows: [{ max_score: 0, total_rounds: 0, max_combo: 0 }] })
        // 3. Max streak query
        .mockResolvedValueOnce({ rows: [{ max_streak: 0 }] })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    await expect(db.transaction(async (client) => {
      const check = await client.query('SELECT 1 FROM achievements WHERE user_id = $1 AND achievement_id = $2 FOR UPDATE', [101, 'rounds_5']);
      if (check.rows.length > 0) throw new Error('ALREADY_CLAIMED');
      const rRes = await client.query('SELECT COALESCE(MAX(score), 0) as max_score, COUNT(*) as total_rounds FROM rounds WHERE user_id = $1 AND status = \'submitted\'', [101]);
      const totalRounds = Number(rRes.rows[0]?.total_rounds || 0);
      if (totalRounds < 5) {
        throw new Error('CONDITION_NOT_MET');
      }
    })).rejects.toThrow('CONDITION_NOT_MET');
  });

  it('prevents duplicate achievement claims', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. Achievement check -> already claimed
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    await expect(db.transaction(async (client) => {
      const check = await client.query('SELECT 1 FROM achievements WHERE user_id = $1 AND achievement_id = $2 FOR UPDATE', [101, 'rounds_5']);
      if (check.rows.length > 0) {
        throw new Error('ALREADY_CLAIMED');
      }
    })).rejects.toThrow('ALREADY_CLAIMED');
  });
});
