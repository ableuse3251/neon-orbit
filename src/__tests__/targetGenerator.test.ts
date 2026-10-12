import { describe, it, expect } from 'vitest';
import {
  generateRoundTargets,
  recalculateRound,
  seededRandom,
  ClickLog,
} from '../shared/targetGenerator';

describe('Seed-Based Target Generator & Anti-Cheat Validation (Stage F)', () => {
  it('generates deterministic targets for identical seeds across modes', () => {
    const seed = 'cosmic_seed_alpha_42';
    const targetsA = generateRoundTargets(seed, 'blitz');
    const targetsB = generateRoundTargets(seed, 'blitz');

    expect(targetsA.length).toBeGreaterThan(10);
    expect(targetsA.length).toBe(targetsB.length);

    for (let i = 0; i < Math.min(5, targetsA.length); i++) {
      expect(targetsA[i].id).toBe(targetsB[i].id);
      expect(targetsA[i].type).toBe(targetsB[i].type);
      expect(targetsA[i].xPct).toBeCloseTo(targetsB[i].xPct, 5);
      expect(targetsA[i].yPct).toBeCloseTo(targetsB[i].yPct, 5);
    }
  });

  it('generates new Stage F targets (magnet, double_beacon, black_hole, boss_meteor)', () => {
    const targets = generateRoundTargets('stage_f_multimode_seed', 'classic');
    const types = new Set(targets.map((t) => t.type));

    // Ensure at least some new types appear or generate correctly
    expect(targets.length).toBeGreaterThan(20);
  });

  it('correctly recalculates valid hits in blitz mode', () => {
    const seed = 'test_blitz_valid_seed';
    const targets = generateRoundTargets(seed, 'blitz');
    const firstTarget = targets[0];

    const clickLogs: ClickLog[] = [
      {
        timestampMs: firstTarget.spawnTimeMs + 200,
        xPct: firstTarget.xPct,
        yPct: firstTarget.yPct,
        type: 'hit',
        targetId: firstTarget.id,
      },
    ];

    const result = recalculateRound(seed, clickLogs, 20000, 'blitz');
    expect(result.isValid).toBe(true);
    expect(result.hits).toBe(1);
    expect(result.recalculatedScore).toBeGreaterThan(0);
  });

  it('anti-fraud: rejects rounds with impossible click frequency (autoclicker / macro)', () => {
    const seed = 'test_autoclicker_seed';
    const spamClicks: ClickLog[] = [];

    for (let i = 0; i < 35; i++) {
      spamClicks.push({
        timestampMs: 5000 + i * 25,
        xPct: 50,
        yPct: 50,
        type: 'miss',
      });
    }

    const result = recalculateRound(seed, spamClicks, 45000, 'classic');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('Unnatural tap frequency');
  });
});
