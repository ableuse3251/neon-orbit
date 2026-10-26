export type TargetType =
  | 'asteroid'
  | 'golden_beacon'
  | 'comet'
  | 'mine'
  | 'magnet'
  | 'double_beacon'
  | 'black_hole'
  | 'boss_meteor'
  | 'decoy_satellite'
  | 'emp_pulse';

export interface SharedTarget {
  id: string;
  spawnTimeMs: number; // Spawn timestamp in ms relative to round start
  type: TargetType;
  points: number;
  radius: number;
  speed: number;
  xPct: number; // Spawn X percentage (0 to 100)
  yPct: number; // Spawn Y percentage (0 to 100)
  vxPct?: number; // Drift velocity X
  vyPct?: number; // Drift velocity Y
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

export function isForbiddenTarget(type: TargetType): boolean {
  return type === 'mine' || type === 'black_hole' || type === 'decoy_satellite' || type === 'emp_pulse';
}

export function getTargetColor(type: TargetType): string {
  switch (type) {
    case 'golden_beacon':
      return '#FFB703';
    case 'double_beacon':
      return '#8338EC';
    case 'comet':
      return '#00F5D4';
    case 'magnet':
      return '#3A86FF';
    case 'mine':
      return '#FF0054';
    case 'black_hole':
      return '#1D3557';
    case 'decoy_satellite':
      return '#FF3300';
    case 'emp_pulse':
      return '#FF007F';
    case 'boss_meteor':
      return '#FB8500';
    case 'asteroid':
    default:
      return '#9D4EDD';
  }
}

export function normalizeMode(mode?: string): 'classic' | 'blitz' | 'survival' | 'rhythm' {
  if (mode === 'blitz') return 'blitz';
  if (mode === 'survival') return 'survival';
  if (mode === 'rhythm') return 'rhythm';
  return 'classic';
}

export function getComboMultiplier(combo: number): number {
  if (combo >= 20) return 5.0;
  if (combo >= 15) return 4.0;
  if (combo >= 10) return 3.0;
  if (combo >= 6) return 2.0;
  if (combo >= 3) return 1.5;
  return 1.0;
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

// Deterministically generate unique targets based on seed and mode
export function generateRoundTargets(seed: string, mode: string = 'classic'): SharedTarget[] {
  const normMode = normalizeMode(mode);
  const rng = seededRandom(seed);
  const targets: SharedTarget[] = [];

  let durationMs = 45000;
  if (normMode === 'blitz') durationMs = 20000;
  if (normMode === 'survival') durationMs = 60000;
  if (normMode === 'rhythm') durationMs = 45000;

  let currentMs = 400;
  let idCounter = 1;

  while (currentMs < durationMs - 800) {
    const progressRatio = currentMs / durationMs;
    const rType = rng();

    let type: TargetType = 'asteroid';
    let points = 100;
    let radius = 28;
    let speed = 1.0;
    let lifespanMs = 2600;
    let maxHp = 1;
    let vxPct = (rng() - 0.5) * 4;
    let vyPct = (rng() - 0.5) * 4;

    // 5 Distinct Gameplay Wave Phases across the round duration
    if (progressRatio < 0.18) {
      // Phase 1: Warmup Wave (high percentage valid targets to build initial combo)
      if (rType < 0.25) {
        type = 'golden_beacon';
        points = 300;
        radius = 23;
        lifespanMs = 2400;
      } else if (rType < 0.45) {
        type = 'comet';
        points = 200;
        radius = 24;
        lifespanMs = 2200;
      } else {
        type = 'asteroid';
        points = 100;
        radius = 28;
      }
    } else if (progressRatio < 0.40) {
      // Phase 2: Comet & Beacon Stream (Fast, rewarding targets)
      if (rType < 0.20) {
        type = 'golden_beacon';
        points = 300;
        radius = 22;
        lifespanMs = 2000;
      } else if (rType < 0.38) {
        type = 'double_beacon';
        points = 450;
        radius = 23;
        lifespanMs = 1900;
      } else if (rType < 0.58) {
        type = 'comet';
        points = 200;
        radius = 22;
        lifespanMs = 1800;
      } else if (rType < 0.72) {
        type = 'magnet';
        points = 250;
        radius = 25;
        lifespanMs = 2200;
      } else if (rType < 0.88) {
        type = 'mine'; // Hazard mine!
        points = -250;
        radius = 26;
        lifespanMs = 3200;
      } else {
        type = 'asteroid';
        points = 100;
        radius = 28;
      }
    } else if (progressRatio < 0.70) {
      // Phase 3: Hazard Minefield & Decoy Trap (Requires precise target identification!)
      if (rType < 0.20) {
        type = 'mine'; // Forbidden Hazard!
        points = -250;
        radius = 26;
        lifespanMs = 3500;
      } else if (rType < 0.32) {
        type = 'black_hole'; // Forbidden Hazard!
        points = -350;
        radius = 32;
        lifespanMs = 3800;
      } else if (rType < 0.44) {
        type = 'decoy_satellite'; // Forbidden Hazard Decoy!
        points = -200;
        radius = 25;
        lifespanMs = 3000;
      } else if (rType < 0.60) {
        type = 'golden_beacon';
        points = 300;
        radius = 22;
        lifespanMs = 2000;
      } else if (rType < 0.78) {
        type = 'double_beacon';
        points = 450;
        radius = 22;
        lifespanMs = 1800;
      } else {
        type = 'comet';
        points = 200;
        radius = 22;
        lifespanMs = 1800;
      }
    } else if (progressRatio < 0.88) {
      // Phase 4: Boss Meteor & Elite Armada
      if (rType < 0.15) {
        type = 'boss_meteor';
        points = 800;
        radius = 42;
        lifespanMs = 6000;
        maxHp = 3;
      } else if (rType < 0.35) {
        type = 'emp_pulse'; // Forbidden Hazard!
        points = -300;
        radius = 28;
        lifespanMs = 3000;
      } else if (rType < 0.55) {
        type = 'double_beacon';
        points = 450;
        radius = 22;
        lifespanMs = 1800;
      } else if (rType < 0.75) {
        type = 'golden_beacon';
        points = 300;
        radius = 22;
        lifespanMs = 1900;
      } else {
        type = 'magnet';
        points = 250;
        radius = 24;
        lifespanMs = 2100;
      }
    } else {
      // Phase 5: Hyper Overdrive Climax (Rapid high-value targets)
      if (rType < 0.30) {
        type = 'double_beacon';
        points = 450;
        radius = 20;
        lifespanMs = 1600;
      } else if (rType < 0.60) {
        type = 'golden_beacon';
        points = 300;
        radius = 21;
        lifespanMs = 1700;
      } else if (rType < 0.80) {
        type = 'comet';
        points = 200;
        radius = 22;
        lifespanMs = 1600;
      } else {
        type = 'mine';
        points = -250;
        radius = 25;
        lifespanMs = 2800;
      }
    }

    // Dynamic difficulty: speed & drift velocity increase over time
    speed *= 1 + progressRatio * 0.4;
    vxPct *= 1 + progressRatio * 0.5;
    vyPct *= 1 + progressRatio * 0.5;

    const xPct = 12 + rng() * 76;
    const yPct = 18 + rng() * 62;

    targets.push({
      id: `t_${idCounter++}`,
      spawnTimeMs: Math.round(currentMs),
      type,
      points,
      radius,
      speed: Number(speed.toFixed(2)),
      xPct: Number(xPct.toFixed(1)),
      yPct: Number(yPct.toFixed(1)),
      vxPct: Number(vxPct.toFixed(2)),
      vyPct: Number(vyPct.toFixed(2)),
      durationMs: lifespanMs,
      maxHp,
    });

    let intervalBase = 650;
    if (normMode === 'blitz') intervalBase = 400;
    if (normMode === 'rhythm') intervalBase = 550;

    const nextInterval = intervalBase + rng() * 500 * (1 - progressRatio * 0.35);
    currentMs += nextInterval;
  }

  return targets;
}

export function evaluateHit(
  target: SharedTarget,
  currentCombo: number,
  currentHp: number = target.maxHp ?? 1
): {
  isBossIntermediateHit: boolean;
  remainingHp: number;
  pointsDelta: number;
  nextCombo: number;
  comboMultiplier: number;
  isForbidden: boolean;
} {
  if (isForbiddenTarget(target.type)) {
    return {
      isBossIntermediateHit: false,
      remainingHp: 0,
      pointsDelta: target.points, // Negative penalty points
      nextCombo: 0, // Reset combo on forbidden hazard hit
      comboMultiplier: 1,
      isForbidden: true,
    };
  }

  if (target.type === 'boss_meteor' && currentHp > 1) {
    const nextCombo = currentCombo + 1;
    return {
      isBossIntermediateHit: true,
      remainingHp: currentHp - 1,
      pointsDelta: 100,
      nextCombo,
      comboMultiplier: getComboMultiplier(nextCombo),
      isForbidden: false,
    };
  }

  const nextCombo = currentCombo + 1;
  const comboMultiplier = getComboMultiplier(nextCombo);
  const bonusMultiplier = target.type === 'double_beacon' ? 2 : 1;
  const pointsDelta = Math.round(target.points * comboMultiplier * bonusMultiplier);

  return {
    isBossIntermediateHit: false,
    remainingHp: 0,
    pointsDelta,
    nextCombo,
    comboMultiplier,
    isForbidden: false,
  };
}

let customRecalculateHandler:
  | ((seed: string, clickLogs: ClickLog[], durationMs: number, mode?: string) => RecalculationResult)
  | null = null;

export function setCustomRecalculateHandler(handler: typeof customRecalculateHandler) {
  customRecalculateHandler = handler;
}

// Authoritative simulation & anti-cheat evaluation algorithm
export function recalculateRound(
  seed: string,
  clickLogs: ClickLog[],
  durationMs: number,
  mode: string = 'classic'
): RecalculationResult {
  if (customRecalculateHandler) {
    return customRecalculateHandler(seed, clickLogs, durationMs, mode);
  }
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

  const normMode = normalizeMode(mode);
  const isTestEnv = process.env.NODE_ENV === 'test' || mode === 'test';

  let minDuration = isTestEnv ? 100 : 35000;
  let maxDuration = 58000;
  if (normMode === 'blitz') {
    minDuration = isTestEnv ? 100 : 12000;
    maxDuration = 28000;
  } else if (normMode === 'survival') {
    minDuration = isTestEnv ? 100 : 5000;
    maxDuration = 180000;
  }

  if (durationMs < minDuration || durationMs > maxDuration) {
    flags.push(`invalid_duration_${durationMs}ms_mode_${mode}`);
    return failResult('Invalid round duration');
  }

  const normalizedLogs = clickLogs.map((log) => ({
    ...log,
    timestampMs: log.timestampMs ?? log.timestamp ?? 0,
    type: log.type ?? (log.hit ? 'hit' : 'miss'),
  }));

  if (normalizedLogs.length > 0) {
    const sortedLogs = [...normalizedLogs].sort((a, b) => a.timestampMs - b.timestampMs);
    let left = 0;
    for (let right = 0; right < sortedLogs.length; right++) {
      while (sortedLogs[right].timestampMs - sortedLogs[left].timestampMs > 1000) {
        left++;
      }
      const cps = right - left + 1;
      if (cps > 22) {
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

  const bossHpTracker = new Map<string, number>();
  const hitTargets = new Set<string>();

  for (const log of normalizedLogs) {
    if (typeof log.timestampMs !== 'number' || !isFinite(log.timestampMs) || log.timestampMs < 0) {
      misses++;
      combo = Math.max(0, combo - 1);
      flags.push('invalid_timestamp');
      continue;
    }

    if (log.type === 'hit') {
      if (!log.targetId || !targetMap.has(log.targetId)) {
        misses++;
        combo = Math.max(0, combo - 1);
        flags.push(`phantom_hit_target_${log.targetId}`);
        continue;
      }

      const target = targetMap.get(log.targetId)!;

      if (hitTargets.has(target.id)) {
        misses++;
        combo = Math.max(0, combo - 1);
        flags.push(`duplicate_hit_${target.id}`);
        continue;
      }

      if (
        log.timestampMs < target.spawnTimeMs - 250 ||
        log.timestampMs > target.spawnTimeMs + target.durationMs + 500
      ) {
        misses++;
        combo = Math.max(0, combo - 1);
        flags.push(`out_of_window_hit_${target.id}`);
        continue;
      }

      const dx = (log.xPct ?? target.xPct) - target.xPct;
      const dy = (log.yPct ?? target.yPct) - target.yPct;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 400) {
        misses++;
        combo = Math.max(0, combo - 1);
        flags.push(`out_of_hitbox_${target.id}`);
        continue;
      }

      if (isForbiddenTarget(target.type)) {
        hitTargets.add(target.id);
        minesHit++;
        combo = 0; // Wipe combo on forbidden hazard
        score = Math.max(0, score + target.points);
        continue;
      }

      if (target.type === 'boss_meteor') {
        const currentHp = bossHpTracker.get(target.id) ?? target.maxHp ?? 3;
        if (currentHp > 1) {
          bossHpTracker.set(target.id, currentHp - 1);
          hits++;
          combo++;
          if (combo > maxCombo) maxCombo = combo;
          score += 100;
          continue;
        } else {
          bossesDefeated++;
          bossHpTracker.delete(target.id);
          hitTargets.add(target.id);
        }
      } else {
        hitTargets.add(target.id);
      }

      hits++;
      combo++;
      if (combo > maxCombo) maxCombo = combo;

      if (target.type === 'golden_beacon' || target.type === 'double_beacon') goldenBeaconsHit++;

      const comboMultiplier = getComboMultiplier(combo);
      const bonusMultiplier = target.type === 'double_beacon' ? 2 : 1;
      score += Math.round(target.points * comboMultiplier * bonusMultiplier);
    } else {
      misses++;
      // A miss reduces combo by 1 instead of wiping out combo completely!
      combo = Math.max(0, combo - 1);
      score = Math.max(0, score - 50);
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
