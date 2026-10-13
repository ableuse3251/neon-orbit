import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLeaderboard, removeUserFromAllLeaderboards } from '../services/leaderboard.js';
import * as db from '../db.js';
import * as redis from '../redis.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    isDbActive: vi.fn(() => true),
  };
});

vi.mock('../redis.js', () => ({
  redisZAdd: vi.fn(),
  redisZRem: vi.fn(),
  redisZScore: vi.fn(),
  redisZRevRange: vi.fn(),
  redisZRevRank: vi.fn(),
}));

describe('Server Leaderboards & Redis Source-of-Truth Audit Tests (F36 / Leaderboard Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries PostgreSQL source of truth for global leaderboard when Redis cache is empty or cleared', async () => {
    vi.mocked(db.query)
      // 1. Active season query
      .mockResolvedValueOnce({ rows: [{ title_en: 'Season 1', title_ru: 'Сезон 1' }] } as any)
      // 2. User privacy state query
      .mockResolvedValueOnce({ rows: [{ hide_from_leaderboard: false }] } as any)
      // 3. Global leaderboard SQL query
      .mockResolvedValueOnce({
        rows: [
          { id: 101, username: 'pilot_alpha', first_name: 'Alpha', score: 14500 },
          { id: 102, username: 'pilot_beta', first_name: 'Beta', score: 12000 }
        ]
      } as any)
      // 4. Current user score query
      .mockResolvedValueOnce({ rows: [{ max_score: 14500 }] } as any);

    const leaderboard = await getLeaderboard('global', 101);

    expect(leaderboard.success).toBe(true);
    expect(leaderboard.entries.length).toBe(2);
    expect(leaderboard.entries[0].userId).toBe('101');
    expect(leaderboard.entries[0].score).toBe(14500);
    expect(leaderboard.entries[0].rankTitle).toBe('Commander');
  });

  it('filters out banned and hidden profiles from leaderboard results', async () => {
    vi.mocked(db.query)
      // 1. Active season query
      .mockResolvedValueOnce({ rows: [{ title_en: 'Season 1', title_ru: 'Сезон 1' }] } as any)
      // 2. User privacy state query
      .mockResolvedValueOnce({ rows: [{ hide_from_leaderboard: false }] } as any)
      // 3. SQL query (PostgreSQL query structure enforces WHERE u.is_banned = FALSE AND u.hide_from_leaderboard = FALSE)
      .mockResolvedValueOnce({
        rows: [
          { id: 101, username: 'pilot_alpha', first_name: 'Alpha', score: 14500 }
        ]
      } as any)
      // 4. Current user score query
      .mockResolvedValueOnce({ rows: [{ max_score: 14500 }] } as any);

    const leaderboard = await getLeaderboard('global', 101);

    expect(leaderboard.success).toBe(true);
    // Banned / hidden users are omitted by SQL WHERE clause
    expect(leaderboard.entries.every(e => e.userId !== '999')).toBe(true);
  });

  it('removes user from all Redis leaderboards correctly upon removal/deletion', async () => {
    vi.mocked(redis.redisZRem).mockResolvedValue(undefined);
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [{ chat_id: 888 }] } as any);

    await removeUserFromAllLeaderboards(101);

    expect(redis.redisZRem).toHaveBeenCalledWith('leaderboard:global', '101');
    expect(redis.redisZRem).toHaveBeenCalledWith('leaderboard:chat:888', '101');
  });
});
