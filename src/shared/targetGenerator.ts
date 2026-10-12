export type TargetType = 'asteroid' | 'golden_beacon' | 'comet' | 'mine' | 'magnet' | 'double_beacon' | 'black_hole' | 'boss_meteor';

export interface SharedTarget {
  id: string;
  spawnTimeMs: number; // Spawn timestamp in ms relative to round start
  type: TargetType;
  points: number;
  radius: number;
  speed: number;
  xPct: number; // Spawn X percentage (0 to 100)
  yPct: number; // Spawn Y percentage (0 to 100)
  durationMs: number; // Target active lifespan
  maxHp?: number; // For boss_meteor
}

export interface ClickLog {
  timestampMs: number; // Relative to round start time on client
  xPct: number;
  yPct: number;
  type: 'hit' | 'miss';
  targetId?: string;
  targetType?: string;
  scoreGained?: number;
  timestamp?: number;
  hit?: boolean;
  x?: number;
  y?: number;
}

export interface RecalculationResult {
  accepted: boolean;
  isValid: boolean;
  score: number;
  recalculatedScore: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  totalTaps: number;
  accuracy: number;
  goldenBeaconsHit: number;
  minesHit: number;
  blackHolesHit: number;
  bossesDefeated: number;
  rejectionReason?: string;
  flags: string[];
}

// Pseudo-random number generator using Linear Congruential Generator (LCG)
export function seededRandom(seedStr: string): () => number {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Deterministically generate targets based on seed and mode
export function generateRoundTargets(seed: string, mode: string = 'classic'): SharedTarget[] {
  const rng = seededRandom(seed);
  const targets: SharedTarget[] = [];
  
  let durationMs = 45000;
  if (mode === 'blitz') durationMs = 20000;
  if (mode === 'survival') durationMs = 60000;
  if (mode === 'rhythm') durationMs = 45000;

  let currentMs = 500;
  let idCounter = 1;

  while (currentMs < durationMs - 1000) {
    const rType = rng();
    let type: TargetType = 'asteroid';
    let points = 100;
    let radius = 28;
    let speed = 1.0;
    let lifespanMs = 2500;
    let maxHp = 1;

    // Balance weights across target types
    if (rType < 0.10) {
      type = 'golden_beacon';
      points = 300;
      radius = 22;
      speed = 1.4;
      lifespanMs = 2000;
    } else if (rType < 0.18) {
      type = 'double_beacon';
      points = 450;
      radius = 23;
      speed = 1.5;
      lifespanMs = 1900;
    } else if (rType < 0.28) {
      type = 'comet';
      points = 200;
      radius = 24;
      speed = 2.1;
      lifespanMs = 1700;
    } else if (rType < 0.38) {
      type = 'magnet';
      points = 250;
      radius = 25;
      speed = 1.2;
      lifespanMs = 2200;
    } else if (rType < 0.52) {
      type = 'mine';
      points = -150;
      radius = 26;
      speed = 0.9;
      lifespanMs = 3000;
    } else if (rType < 0.58) {
      type = 'black_hole';
      points = -250;
      radius = 32;
      speed = 0.6;
      lifespanMs = 3500;
    } else if (rType < 0.62) {
      type = 'boss_meteor';
      points = 800;
      radius = 42;
      speed = 0.7;
      lifespanMs = 5000;
      maxHp = 3;
    }

    // Adaptive difficulty: speed & density increase slightly over time
    const progressFactor = currentMs / durationMs;
    speed *= (1 + progressFactor * 0.35);

    const xPct = 12 + rng() * 76;
    const yPct = 18 + rng() * 64;

    targets.push({
      id: `t_${idCounter++}`,
      spawnTimeMs: Math.round(currentMs),
      type,
      points,
      radius,
      speed: Number(speed.toFixed(2)),
      xPct: Number(xPct.toFixed(1)),
      yPct: Number(yPct.toFixed(1)),
      durationMs: lifespanMs,
      maxHp,
    });

    // Spawn interval adjusted by mode
    let intervalBase = 700;
    if (mode === 'blitz') intervalBase = 450;
    if (mode === 'rhythm') intervalBase = 600; // sync rhythm beat

    const nextInterval = intervalBase + rng() * 600 * (1 - progressFactor * 0.3);
    currentMs += nextInterval;
  }

  return targets;
}

// Server recalculation & anti-cheat algorithm updated for Stage F
export function recalculateRound(
  seed: string,
  clickLogs: ClickLog[],
  durationMs: number,
  mode: string = 'classic'
): RecalculationResult {
  const flags: string[] = [];

  const failResult = (reason: string): RecalculationResult => ({
    accepted: false,
    isValid: false,
    score: 0,
    recalculatedScore: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    totalTaps: clickLogs.length,
    accuracy: 0,
    goldenBeaconsHit: 0,
    minesHit: 0,
    blackHolesHit: 0,
    bossesDefeated: 0,
    rejectionReason: reason,
    flags,
  });

  // Duration validation based on mode
  let minDuration = 38000;
  let maxDuration = 55000;
  if (mode === 'blitz') {
    minDuration = 15000;
    maxDuration = 28000;
  } else if (mode === 'survival') {
    minDuration = 5000;
    maxDuration = 180000;
  }

  if (durationMs < minDuration || durationMs > maxDuration) {
    flags.push(`invalid_duration_${durationMs}ms_mode_${mode}`);
    return failResult('Invalid round duration');
  }

  // Normalize logs
  const normalizedLogs = clickLogs.map((log) => ({
    ...log,
    timestampMs: log.timestampMs ?? log.timestamp ?? 0,
    type: log.type ?? (log.hit ? 'hit' : 'miss'),
  }));

  // Tap frequency check (max 20 clicks/sec sliding window)
  if (normalizedLogs.length > 0) {
    const sortedLogs = [...normalizedLogs].sort((a, b) => a.timestampMs - b.timestampMs);
    let left = 0;
    for (let right = 0; right < sortedLogs.length; right++) {
      while (sortedLogs[right].timestampMs - sortedLogs[left].timestampMs > 1000) {
        left++;
      }
      const cps = right - left + 1;
      if (cps > 20) {
        flags.push(`autoclicker_cps_${cps}`);
        return failResult('Unnatural tap frequency detected');
      }
    }
  }

  const generatedTargets = generateRoundTargets(seed, mode);
  const targetMap = new Map<string, SharedTarget>();
  generatedTargets.forEach((t) => targetMap.set(t.id, t));

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let misses = 0;
  let goldenBeaconsHit = 0;
  let minesHit = 0;
  let blackHolesHit = 0;
  let bossesDefeated = 0;

  // Track boss HP tracking on server validation
  const bossHpTracker = new Map<string, number>();

  for (const log of normalizedLogs) {
    if (log.type === 'hit') {
      if (!log.targetId || !targetMap.has(log.targetId)) {
        misses++;
        combo = 0;
        flags.push(`phantom_hit_target_${log.targetId}`);
        continue;
      }

      const target = targetMap.get(log.targetId)!;
      if (
        log.timestampMs < target.spawnTimeMs - 250 ||
        log.timestampMs > target.spawnTimeMs + target.durationMs + 500
      ) {
        misses++;
        combo = 0;
        flags.push(`out_of_window_hit_${target.id}`);
        continue;
      }

      if (target.type === 'boss_meteor') {
        const currentHp = bossHpTracker.get(target.id) ?? target.maxHp ?? 3;
        if (currentHp > 1) {
          bossHpTracker.set(target.id, currentHp - 1);
          hits++;
          // Partial hit on boss
          score += 100;
          continue;
        } else {
          bossesDefeated++;
          bossHpTracker.delete(target.id);
        }
      }

      hits++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      if (target.type === 'golden_beacon' || target.type === 'double_beacon') goldenBeaconsHit++;
      if (target.type === 'mine') minesHit++;
      if (target.type === 'black_hole') blackHolesHit++;

      const comboMultiplier = 1 + Math.floor(combo / 5) * 0.25;
      if (target.points > 0) {
        const bonusMultiplier = target.type === 'double_beacon' ? 2 : 1;
        score += Math.round(target.points * comboMultiplier * bonusMultiplier);
      } else {
        score = Math.max(0, score + target.points);
        combo = 0;
      }
    } else {
      misses++;
      combo = 0;
    }
  }

  const accuracy = normalizedLogs.length > 0 ? (hits / normalizedLogs.length) * 100 : 0;

  return {
    accepted: true,
    isValid: true,
    score,
    recalculatedScore: score,
    combo,
    maxCombo,
    hits,
    misses,
    totalTaps: normalizedLogs.length,
    accuracy,
    goldenBeaconsHit,
    minesHit,
    blackHolesHit,
    bossesDefeated,
    flags,
  };
}
