import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isGoldenHourActiveServer, getActiveEventConfig } from '../services/events.js';
import * as db from '../db.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    isDbActive: vi.fn(() => true),
  };
});

describe('Server Events & Golden Hour Audit Tests (F37 / Live Ops Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('respects active golden hour config from database (single source of truth)', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{
        value: {
          id: 'season_1',
          isGoldenHourActive: true,
          goldenHourMultiplier: 3,
          endDateISO: '2030-12-31T23:59:59Z'
        }
      }]
    } as any);

    const status = await isGoldenHourActiveServer();
    expect(status.isActive).toBe(true);
    expect(status.multiplier).toBe(3);
  });

  it('deactivates golden hour when expired past endDateISO', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{
        value: {
          id: 'season_1',
          isGoldenHourActive: true,
          goldenHourMultiplier: 2,
          endDateISO: '2020-01-01T00:00:00Z' // Expired in past
        }
      }]
    } as any);

    const status = await isGoldenHourActiveServer();
    expect(status.isActive).toBe(false);
    expect(status.multiplier).toBe(1);
  });

  it('handles missing configuration gracefully by falling back to default inactive state', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rows: [] } as any);

    const cfg = await getActiveEventConfig();
    expect(cfg.isGoldenHourActive).toBe(false);

    const status = await isGoldenHourActiveServer();
    expect(status.isActive).toBe(false);
  });

  it('evaluates event time boundaries and multipliers purely on server', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [{
        value: {
          isGoldenHourActive: true,
          goldenHourMultiplier: 2.5,
          endDateISO: '2035-01-01T00:00:00Z'
        }
      }]
    } as any);

    const status = await isGoldenHourActiveServer();
    expect(status.isActive).toBe(true);
    expect(status.multiplier).toBe(2.5);
  });
});
