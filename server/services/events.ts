import { query, isDbActive } from '../db.js';

export interface LiveEventConfig {
  id: string;
  titleEn: string;
  titleRu: string;
  eventType: string;
  isGoldenHourActive: boolean;
  goldenHourMultiplier: number;
  endDateISO: string;
}

const DEFAULT_LIVE_EVENT: LiveEventConfig = {
  id: 'season_1',
  titleEn: 'Season 1: Neon Storm',
  titleRu: 'Сезон 1: Неоновый Шторм',
  eventType: 'golden_hour',
  isGoldenHourActive: false,
  goldenHourMultiplier: 2,
  endDateISO: '2026-12-31T23:59:59Z',
};

export async function getActiveEventConfig(): Promise<LiveEventConfig> {
  if (isDbActive()) {
    try {
      const res = await query(`SELECT value FROM app_config WHERE key = 'live_event'`);
      if (res.rows.length > 0 && res.rows[0].value) {
        return { ...DEFAULT_LIVE_EVENT, ...res.rows[0].value };
      }
    } catch (err) {
      console.error('Error reading active event config from DB:', err);
    }
  }
  return DEFAULT_LIVE_EVENT;
}

export async function isGoldenHourActiveServer(): Promise<{ isActive: boolean; multiplier: number }> {
  const cfg = await getActiveEventConfig();
  if (!cfg.isGoldenHourActive) {
    return { isActive: false, multiplier: 1 };
  }

  // Check expiration (endDateISO)
  if (cfg.endDateISO) {
    const endMs = new Date(cfg.endDateISO).getTime();
    if (!isNaN(endMs) && Date.now() > endMs) {
      return { isActive: false, multiplier: 1 };
    }
  }

  const multiplier = Number(cfg.goldenHourMultiplier) || 2;
  return { isActive: true, multiplier };
}
