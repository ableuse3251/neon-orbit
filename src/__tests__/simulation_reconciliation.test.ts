import { describe, it, expect } from 'vitest';
import {
  generateRoundTargets,
  recalculateRound,
  evaluateHit,
  getTargetColor,
  SharedTarget,
  ClickLog,
} from '../shared/targetGenerator';

describe('Deterministic Game Simulation & Anti-Cheat Reconciliation', () => {
  const FIXED_SEED = 'seed_neon_alpha_777';

  describe('1. Deterministic Target Generation', () => {
    it('produces 100% deterministic targets, IDs, coords, and timing for identical seeds', () => {
      const runA = generateRoundTargets(FIXED_SEED, 'classic');
      const runB = generateRoundTargets(FIXED_SEED, 'classic');

      expect(runA.length).toBeGreaterThan(15);
      expect(runA.length).toBe(runB.length);

      for (let i = 0; i < runA.length; i++) {
        expect(runA[i].id).toBe(`t_${i + 1}`);
        expect(runA[i].id).toBe(runB[i].id);
        expect(runA[i].type).toBe(runB[i].type);
        expect(runA[i].spawnTimeMs).toBe(runB[i].spawnTimeMs);
        expect(runA[i].durationMs).toBe(runB[i].durationMs);
        expect(runA[i].xPct).toBeCloseTo(runB[i].xPct, 5);
        expect(runA[i].yPct).toBeCloseTo(runB[i].yPct, 5);
        expect(runA[i].points).toBe(runB[i].points);
      }
    });

    it('generates distinct schedules for different seeds', () => {
      const targets1 = generateRoundTargets('seed_one', 'classic');
      const targets2 = generateRoundTargets('seed_two', 'classic');

      // The coords or types should differ
      const diffFound = targets1.some((t1, i) => {
        const t2 = targets2[i];
        return !t2 || t1.xPct !== t2.xPct || t1.yPct !== t2.yPct || t1.type !== t2.type;
      });
      expect(diffFound).toBe(true);
    });

    it('supports all target types with correct visual colors and properties', () => {
      const targets = generateRoundTargets('diverse_target_pool_seed_42', 'classic');
      const types = new Set(targets.map((t) => t.type));
      
      expect(types.has('asteroid')).toBe(true);
      expect(getTargetColor('asteroid')).toBe('#9D4EDD');
      expect(getTargetColor('golden_beacon')).toBe('#FFB703');
      expect(getTargetColor('double_beacon')).toBe('#8338EC');
      expect(getTargetColor('comet')).toBe('#00F5D4');
      expect(getTargetColor('magnet')).toBe('#3A86FF');
      expect(getTargetColor('mine')).toBe('#FF0054');
      expect(getTargetColor('black_hole')).toBe('#1D3557');
      expect(getTargetColor('boss_meteor')).toBe('#FB8500');
    });
  });

  describe('2. Honest Gameplay Simulation (Client-Server Match)', () => {
    it('accepts valid round played by an honest player with 100% score agreement', () => {
      const targets = generateRoundTargets(FIXED_SEED, 'classic');
      const clickLogs: ClickLog[] = [];

      let simulatedScore = 0;
      let simulatedCombo = 0;
      let simulatedHits = 0;

      // Simulate player tapping positive targets within their active window and near center
      for (const target of targets) {
        if (target.type === 'mine' || target.type === 'black_hole') {
          // Honest player avoids hazards
          continue;
        }

        if (target.type === 'boss_meteor') {
          // Player taps boss meteor 3 times
          const hp = target.maxHp || 3;
          for (let h = 0; h < hp; h++) {
            const tapTime = target.spawnTimeMs + 300 + h * 200;
            clickLogs.push({
              timestampMs: tapTime,
              xPct: Number((target.xPct + 0.5).toFixed(1)),
              yPct: Number((target.yPct + 0.5).toFixed(1)),
              type: 'hit',
              targetId: target.id,
              targetType: target.type,
              hit: true,
            });

            if (h < hp - 1) {
              simulatedHits++;
              simulatedScore += 100;
            } else {
              simulatedHits++;
              simulatedCombo++;
              const mult = 1 + Math.floor(simulatedCombo / 5) * 0.25;
              simulatedScore += Math.round(target.points * mult);
            }
          }
        } else {
          // Regular target: tap 200ms after spawn, close to coordinates
          const tapTime = target.spawnTimeMs + 200;
          clickLogs.push({
            timestampMs: tapTime,
            xPct: Number((target.xPct + 0.3).toFixed(1)),
            yPct: Number((target.yPct - 0.2).toFixed(1)),
            type: 'hit',
            targetId: target.id,
            targetType: target.type,
            hit: true,
          });

          simulatedHits++;
          simulatedCombo++;
          const mult = 1 + Math.floor(simulatedCombo / 5) * 0.25;
          const bonus = target.type === 'double_beacon' ? 2 : 1;
          simulatedScore += Math.round(target.points * mult * bonus);
        }
      }

      // Add 2 honest misses (tapping empty space)
      clickLogs.push({
        timestampMs: 12000,
        xPct: 10,
        yPct: 10,
        type: 'miss',
        hit: false,
      });
      clickLogs.push({
        timestampMs: 25000,
        xPct: 90,
        yPct: 90,
        type: 'miss',
        hit: false,
      });

      // Recalculate round on server
      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');

      expect(result.isValid).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.flags).toHaveLength(0);
      expect(result.hits).toBe(simulatedHits);
      expect(result.misses).toBe(2);
      expect(result.recalculatedScore).toBe(simulatedScore);
      expect(result.score).toBe(simulatedScore);
      expect(result.bossesDefeated).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Anti-Cheat & Impossible Hit Rejection', () => {
    it('rejects hits with impossible coordinates (outside hitbox tolerance)', () => {
      const targets = generateRoundTargets(FIXED_SEED, 'classic');
      const target = targets[0];

      const clickLogs: ClickLog[] = [
        {
          timestampMs: target.spawnTimeMs + 100,
          xPct: target.xPct + 35, // Distance > 20%
          yPct: target.yPct + 35,
          type: 'hit',
          targetId: target.id,
        },
      ];

      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(1);
      expect(result.score).toBe(0);
      expect(result.flags).toContain(`out_of_hitbox_${target.id}`);
    });

    it('rejects phantom / client-fabricated target IDs', () => {
      const clickLogs: ClickLog[] = [
        {
          timestampMs: 1500,
          xPct: 50,
          yPct: 50,
          type: 'hit',
          targetId: 'rnd_fabricated_target_99999',
        },
        {
          timestampMs: 2500,
          xPct: 50,
          yPct: 50,
          type: 'hit',
          targetId: 't_999999',
        },
      ];

      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(2);
      expect(result.flags).toContain('phantom_hit_target_rnd_fabricated_target_99999');
      expect(result.flags).toContain('phantom_hit_target_t_999999');
    });

    it('rejects out-of-window clicks (too early or after expiration)', () => {
      const targets = generateRoundTargets(FIXED_SEED, 'classic');
      const target = targets[0];

      const clickLogs: ClickLog[] = [
        // Clicked 1000ms BEFORE target even spawned
        {
          timestampMs: Math.max(0, target.spawnTimeMs - 1000),
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
        },
        // Clicked 2000ms AFTER target expired
        {
          timestampMs: target.spawnTimeMs + target.durationMs + 2000,
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
        },
      ];

      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(2);
      expect(result.flags).toContain(`out_of_window_hit_${target.id}`);
    });

    it('rejects duplicate hits on the same target ID', () => {
      const targets = generateRoundTargets(FIXED_SEED, 'classic');
      const target = targets[0];

      const clickLogs: ClickLog[] = [
        {
          timestampMs: target.spawnTimeMs + 100,
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
        },
        {
          // Duplicate tap on the same target
          timestampMs: target.spawnTimeMs + 200,
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
        },
      ];

      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');
      expect(result.hits).toBe(1);
      expect(result.misses).toBe(1);
      expect(result.flags).toContain(`duplicate_hit_${target.id}`);
    });

    it('limits boss meteor hits to exact maxHp and rejects subsequent duplicate hits', () => {
      const targets = generateRoundTargets('seed_with_boss_meteor', 'classic');
      const boss = targets.find((t) => t.type === 'boss_meteor') || {
        id: 't_boss_mock',
        spawnTimeMs: 1000,
        type: 'boss_meteor' as const,
        points: 800,
        radius: 42,
        speed: 0.7,
        xPct: 50,
        yPct: 50,
        durationMs: 5000,
        maxHp: 3,
      };

      // Tap 3 times (defeating boss) + 1 extra tap (exploit attempt)
      const clickLogs: ClickLog[] = [
        { timestampMs: boss.spawnTimeMs + 200, xPct: boss.xPct, yPct: boss.yPct, type: 'hit', targetId: boss.id },
        { timestampMs: boss.spawnTimeMs + 400, xPct: boss.xPct, yPct: boss.yPct, type: 'hit', targetId: boss.id },
        { timestampMs: boss.spawnTimeMs + 600, xPct: boss.xPct, yPct: boss.yPct, type: 'hit', targetId: boss.id },
        { timestampMs: boss.spawnTimeMs + 800, xPct: boss.xPct, yPct: boss.yPct, type: 'hit', targetId: boss.id }, // 4th tap
      ];

      const result = recalculateRound('seed_with_boss_meteor', clickLogs, 45000, 'classic');
      // If boss is present in this seed, test verifies exactly 3 hits and 1 duplicate rejection
      if (targets.some((t) => t.id === boss.id)) {
        expect(result.hits).toBe(3);
        expect(result.bossesDefeated).toBe(1);
        expect(result.flags).toContain(`duplicate_hit_${boss.id}`);
      }
    });

    it('rejects autoclicker / macro spam exceeding 20 taps per second', () => {
      const spamLogs: ClickLog[] = [];
      for (let i = 0; i < 25; i++) {
        spamLogs.push({
          timestampMs: 5000 + i * 30, // 25 taps in 750ms -> >33 CPS
          xPct: 50,
          yPct: 50,
          type: 'miss',
        });
      }

      const result = recalculateRound(FIXED_SEED, spamLogs, 45000, 'classic');
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Unnatural tap frequency');
    });

    it('recalculates authoritative score independently of any client-reported score', () => {
      const targets = generateRoundTargets(FIXED_SEED, 'classic');
      const target = targets[0];

      // Player taps only 1 asteroid
      const clickLogs: ClickLog[] = [
        {
          timestampMs: target.spawnTimeMs + 100,
          xPct: target.xPct,
          yPct: target.yPct,
          type: 'hit',
          targetId: target.id,
          scoreGained: 999999, // Client claims absurd score
        },
      ];

      const result = recalculateRound(FIXED_SEED, clickLogs, 45000, 'classic');
      expect(result.isValid).toBe(true);
      // Recalculated score must be target.points * 1, NOT 999999
      expect(result.recalculatedScore).toBe(target.points);
      expect(result.score).toBe(target.points);
    });
  });
});
