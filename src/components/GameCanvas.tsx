import React, { useRef, useEffect, useCallback } from 'react';
import { Target, Particle, FloatingText, TargetType, PowerupType, RoundStats, ClickLog } from '../types/game';
import {
  generateRoundTargets,
  getTargetColor,
  SharedTarget,
  isForbiddenTarget,
  getComboMultiplier,
  getEntityCategory,
} from '../shared/targetGenerator';
import { particlePool, floatingTextPool } from '../utils/pool';
import { performanceManager } from '../utils/performance';
import { audioManager } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';
import { trackEvent } from '../utils/analytics';

interface GameCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  shipId?: string;
  shipColor: string;
  shipAccentColor?: string;
  trailType: string;
  backdropId: string;
  crtIntensity: 'off' | 'low' | 'high';
  reduceMotion?: boolean;
  dailySeed?: string;
  roundId?: string;
  isDemo?: boolean;
  seed?: string;
  gameMode?: string;
  onPauseChange?: (paused: boolean) => void;
  onScoreUpdate: (score: number, combo: number, multiplier: number, activePowerups: PowerupType[]) => void;
  onRoundComplete: (stats: RoundStats) => void;
  onTimeUpdate: (timeLeft: number) => void;
}

interface WarpStar {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
}

interface NebulaCloud {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  alpha: number;
}

interface EngineParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface FrostParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isPlaying,
  isPaused,
  shipId = 'ship_cyber_wing',
  shipColor = '#00F5D4',
  shipAccentColor = '#9D4EDD',
  trailType = 'plasma',
  backdropId,
  crtIntensity,
  reduceMotion = false,
  dailySeed,
  roundId,
  isDemo = false,
  seed,
  gameMode = 'classic',
  onPauseChange,
  onScoreUpdate,
  onRoundComplete,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const roundIdRef = useRef<string | undefined>(roundId);
  const isDemoRef = useRef<boolean>(isDemo);
  const scheduledTargetsRef = useRef<SharedTarget[]>([]);
  const nextTargetIndexRef = useRef<number>(0);
  const effectiveSeedRef = useRef<string>('');

  useEffect(() => {
    roundIdRef.current = roundId;
  }, [roundId]);

  useEffect(() => {
    isDemoRef.current = isDemo;
  }, [isDemo]);

  // Mutable Game Loop State
  const gameStateRef = useRef({
    roundStartTime: 0,
    roundDuration: 45,
    timeLeft: 45,
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    totalTaps: 0,
    hits: 0,
    misses: 0,
    minesHit: 0,
    goldenBeaconsHit: 0,
    blackHolesHit: 0,
    bossesDefeated: 0,
    targets: [] as Target[],
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    clickLogs: [] as ClickLog[],
    powerupsUsed: [] as PowerupType[],
    screenShake: 0,
    gridOffset: 0,
    lastFrameTime: performance.now(),

    // Powerup Active State & Particle Systems
    shieldTimeLeft: 0,
    freezeTimeLeft: 0,
    speedBurstTimeLeft: 0,
    magnetTimeLeft: 0,
    shieldAngle: 0,
    shockwaves: [] as ShockwaveRing[],
    frostMist: [] as FrostParticle[],

    // 3D Forward Flight & Spaceship State
    warpStars: [] as WarpStar[],
    nebulaClouds: [] as NebulaCloud[],
    engineParticles: [] as EngineParticle[],
    targetShipSwayX: 0,
    shipSwayX: 0,
    shipBankAngle: 0,
    laserFlashes: [] as { x: number; y: number; alpha: number }[],
  });

  // Initialize 3D Starfield Warp Particles & Space Nebulas
  const init3DSpaceEnvironment = useCallback(() => {
    const stars: WarpStar[] = [];
    const colors = ['#FFFFFF', '#00F5D4', '#FF007F', '#FFB703', '#9D4EDD', '#80FFEA'];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        z: Math.random() * 990 + 10,
        size: Math.random() * 2 + 1,
        color: colors[i % colors.length],
      });
    }

    const nebulas: NebulaCloud[] = [];
    const nebColors = ['#9D4EDD', '#FF007F', '#00F5D4', '#FFB703'];
    for (let i = 0; i < 10; i++) {
      nebulas.push({
        x: (Math.random() - 0.5) * 1200,
        y: (Math.random() - 0.5) * 800,
        z: Math.random() * 800 + 100,
        radius: Math.random() * 150 + 100,
        color: nebColors[i % nebColors.length],
        alpha: Math.random() * 0.18 + 0.08,
      });
    }

    gameStateRef.current.warpStars = stars;
    gameStateRef.current.nebulaClouds = nebulas;
  }, []);

  // Trigger Tactile Powerup Effects & Particle Systems
  const triggerPowerupEffect = useCallback((type: PowerupType, customX?: number, customY?: number) => {
    const state = gameStateRef.current;
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width / (Math.min(window.devicePixelRatio || 1, 2)) : window.innerWidth;
    const height = canvas ? canvas.height / (Math.min(window.devicePixelRatio || 1, 2)) : window.innerHeight;

    const px = customX ?? width / 2;
    const py = customY ?? height / 2;

    if (!state.powerupsUsed.includes(type)) {
      state.powerupsUsed.push(type);
    }

    if (type === 'supernova') {
      // 1. SUPERNOVA MEGA-BOMB POWERUP
      state.screenShake = 32;
      triggerHaptic('impact');

      // Expand Mega-Bomb Shockwave
      state.shockwaves.push({
        x: px,
        y: py,
        radius: 10,
        maxRadius: width * 0.95,
        color: '#FFB703',
        alpha: 1.0,
      });

      // Clear active hazard mines on screen and convert into score bursts
      for (let i = state.targets.length - 1; i >= 0; i--) {
        if (isForbiddenTarget(state.targets[i].type)) {
          const t = state.targets.splice(i, 1)[0];
          const tx = (t.x / 100) * width;
          const ty = (t.y / 100) * height;
          state.score += 150;
          state.floatingTexts.push(
            floatingTextPool.acquire(`fl_bomb_${Date.now()}`, `💥 CLEARED! +150`, tx, ty, '#00F5D4', 1.4)
          );
        }
      }

      state.floatingTexts.push(
        floatingTextPool.acquire(`fl_supernova_${Date.now()}`, `💥 SUPERNOVA MEGA-BOMB!`, px, py - 40, '#FFB703', 1.8)
      );
    } else if (type === 'freeze') {
      // 2. STASIS FROST FREEZE POWERUP
      state.freezeTimeLeft = 6.0;
      triggerHaptic('medium');

      // Spawn Frost Mist Particles
      const frostParticles: FrostParticle[] = [];
      for (let i = 0; i < 35; i++) {
        frostParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 30,
          vy: 20 + Math.random() * 40,
          size: Math.random() * 4 + 2,
          alpha: Math.random() * 0.7 + 0.3,
        });
      }
      state.frostMist = frostParticles;

      state.floatingTexts.push(
        floatingTextPool.acquire(`fl_freeze_${Date.now()}`, `❄️ STASIS FROST (SLOW-MO)`, px, py - 30, '#00F5D4', 1.6)
      );
    } else if (type === 'shield') {
      // 3. PLASMA ENERGY SHIELD POWERUP
      state.shieldTimeLeft = 7.0;
      triggerHaptic('heavy');

      state.floatingTexts.push(
        floatingTextPool.acquire(`fl_shield_${Date.now()}`, `🛡️ PLASMA SHIELD ACTIVE`, px, py - 30, '#FFB703', 1.6)
      );
    } else if (type === 'slow_time') {
      // 4. CHRONOS SPEED-BURST POWERUP
      state.speedBurstTimeLeft = 5.0;
      triggerHaptic('medium');

      state.floatingTexts.push(
        floatingTextPool.acquire(`fl_speed_${Date.now()}`, `⚡ CHRONOS SPEED-BURST`, px, py - 30, '#8338EC', 1.6)
      );
    } else if (type === 'magnet_field') {
      // 5. GRAVITATIONAL MAGNET FIELD POWERUP
      state.magnetTimeLeft = 6.0;
      triggerHaptic('medium');

      state.floatingTexts.push(
        floatingTextPool.acquire(`fl_magnet_${Date.now()}`, `🧲 GRAV-MAGNET FIELD`, px, py - 30, '#3A86FF', 1.6)
      );
    }
  }, []);

  // Reset State and Initialize Scheduled Targets on Round Start
  const startRound = useCallback(() => {
    const now = performance.now();

    const state = gameStateRef.current;
    state.particles.forEach((p) => particlePool.release(p));
    state.floatingTexts.forEach((ft) => floatingTextPool.release(ft));

    init3DSpaceEnvironment();

    const effectiveSeed = (seed || dailySeed || (isDemo ? `demo_norm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` : `norm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`)).trim();
    effectiveSeedRef.current = effectiveSeed;

    const targetsList = generateRoundTargets(effectiveSeed, gameMode);
    scheduledTargetsRef.current = targetsList;
    nextTargetIndexRef.current = 0;

    let roundDuration = 45;
    if (gameMode === 'blitz') roundDuration = 20;
    if (gameMode === 'survival') roundDuration = 60;

    gameStateRef.current = {
      ...gameStateRef.current,
      roundStartTime: now,
      roundDuration,
      timeLeft: roundDuration,
      score: 0,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      totalTaps: 0,
      hits: 0,
      misses: 0,
      minesHit: 0,
      goldenBeaconsHit: 0,
      blackHolesHit: 0,
      bossesDefeated: 0,
      targets: [],
      particles: [],
      floatingTexts: [],
      clickLogs: [],
      powerupsUsed: [],
      shieldTimeLeft: 0,
      freezeTimeLeft: 0,
      speedBurstTimeLeft: 0,
      magnetTimeLeft: 0,
      shieldAngle: 0,
      shockwaves: [],
      frostMist: [],
      screenShake: 0,
      gridOffset: 0,
      lastFrameTime: now,
      engineParticles: [],
      targetShipSwayX: 0,
      shipSwayX: 0,
      shipBankAngle: 0,
      laserFlashes: [],
    };

    onScoreUpdate(0, 0, 1, []);
    onTimeUpdate(roundDuration);
  }, [seed, dailySeed, isDemo, gameMode, init3DSpaceEnvironment, onScoreUpdate, onTimeUpdate]);

  useEffect(() => {
    if (isPlaying) {
      startRound();
    } else {
      const state = gameStateRef.current;
      state.particles.forEach((p) => particlePool.release(p));
      state.particles = [];
      state.floatingTexts.forEach((ft) => floatingTextPool.release(ft));
      state.floatingTexts = [];
    }
  }, [isPlaying, startRound]);

  // Explosion Particle Spawner
  const createExplosion = useCallback(
    (x: number, y: number, color: string, baseCount = 18) => {
      const state = gameStateRef.current;
      const perfConfig = performanceManager.getConfig();
      const count = reduceMotion ? Math.min(6, baseCount) : Math.round(baseCount * perfConfig.particleMultiplier);

      if (count <= 0) return;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 80 + Math.random() * 180;
        const particle = particlePool.acquire(
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          3 + Math.random() * 3,
          color,
          0.3 + Math.random() * 0.35
        );
        state.particles.push(particle);
      }
    },
    [reduceMotion]
  );

  // Handle Multi-touch and Tap Interactions
  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPlaying || isPaused) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const touchX = clientX - rect.left;
      const touchY = clientY - rect.top;
      const cssWidth = rect.width || window.innerWidth;
      const cssHeight = rect.height || window.innerHeight;

      const state = gameStateRef.current;
      state.totalTaps++;

      state.targetShipSwayX = (touchX - cssWidth / 2) * 0.35;
      state.laserFlashes.push({ x: touchX, y: touchY, alpha: 1.0 });

      const nowOffset = performance.now() - state.roundStartTime;
      const tapXPct = Number(((touchX / cssWidth) * 100).toFixed(1));
      const tapYPct = Number(((touchY / cssHeight) * 100).toFixed(1));
      let hitFound = false;

      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        const targetPxX = (target.x / 100) * cssWidth;
        const targetPxY = (target.y / 100) * cssHeight;

        const dx = touchX - targetPxX;
        const dy = touchY - targetPxY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const hitRadius = Math.max(target.radius + 35, 48);

        if (dist <= hitRadius) {
          hitFound = true;

          // 1. HAZARD CATEGORY TARGETS
          if (isForbiddenTarget(target.type)) {
            state.targets.splice(i, 1);
            state.minesHit++;

            // Check if Shield powerup is active to absorb hazard!
            if (state.shieldTimeLeft > 0) {
              audioManager.playShield();
              triggerHaptic('heavy');
              createExplosion(targetPxX, targetPxY, '#00F5D4', 24);
              state.floatingTexts.push(
                floatingTextPool.acquire(`fl_deflect_${Date.now()}`, `🛡️ SHIELD ABSORBED HAZARD!`, targetPxX, targetPxY, '#00F5D4', 1.5)
              );
              break;
            }

            state.combo = 0;
            state.multiplier = 1;

            // HAZARD PENALTY: -3s TIME & -250 SCORE PENALTY
            state.roundStartTime -= 3000;
            state.score = Math.max(0, state.score - 250);

            if (!reduceMotion) {
              state.screenShake = 28;
            }
            audioManager.playMine();
            triggerHaptic('error');
            createExplosion(targetPxX, targetPxY, '#FF0054', 28);

            state.floatingTexts.push(
              floatingTextPool.acquire(
                `fl_${Date.now()}_${Math.random()}`,
                `⚠️ HAZARD! -3s | -250 PTS`,
                targetPxX,
                targetPxY,
                '#FF0054',
                1.6
              )
            );

            state.clickLogs.push({
              timestampMs: Math.round(nowOffset),
              xPct: tapXPct,
              yPct: tapYPct,
              type: 'hit',
              targetId: target.id,
              targetType: target.type,
              hit: true,
              scoreGained: -250,
            });
            break;
          }

          // 2. BOSS METEOR MULTI-HIT TARGET
          if (target.type === 'boss_meteor') {
            if (target.hp > 1) {
              target.hp -= 1;
              state.score += 100;
              state.combo++;
              if (state.combo > state.maxCombo) state.maxCombo = state.combo;
              state.multiplier = getComboMultiplier(state.combo);

              audioManager.playTap(state.combo);
              triggerHaptic('medium');
              createExplosion(targetPxX, targetPxY, target.color, 12);
              state.floatingTexts.push(
                floatingTextPool.acquire(
                  `fl_${Date.now()}_${Math.random()}`,
                  `💥 BOSS HIT! +100 (HP ${target.hp}/${target.maxHp})`,
                  targetPxX,
                  targetPxY,
                  '#FB8500',
                  1.3
                )
              );
              state.clickLogs.push({
                timestampMs: Math.round(nowOffset),
                xPct: tapXPct,
                yPct: tapYPct,
                type: 'hit',
                targetId: target.id,
                targetType: target.type,
                hit: true,
                scoreGained: 100,
              });
              break;
            } else {
              // Final blow on Boss -> Triggers Mega-Bomb Supernova Explosion!
              state.targets.splice(i, 1);
              state.combo++;
              if (state.combo > state.maxCombo) state.maxCombo = state.combo;
              state.multiplier = getComboMultiplier(state.combo);
              const pointsGained = Math.round(target.points * state.multiplier);
              state.score += pointsGained;
              state.bossesDefeated++;
              createExplosion(targetPxX, targetPxY, target.color, 32);
              audioManager.playBeacon();

              // Trigger Supernova Mega-Bomb
              triggerPowerupEffect('supernova', targetPxX, targetPxY);

              state.clickLogs.push({
                timestampMs: Math.round(nowOffset),
                xPct: tapXPct,
                yPct: tapYPct,
                type: 'hit',
                targetId: target.id,
                targetType: target.type,
                hit: true,
                scoreGained: pointsGained,
              });
              break;
            }
          }

          // 3. COLLECTIBLE & SPECIAL POWERUP TARGETS
          state.targets.splice(i, 1);
          state.hits++;
          state.combo++;
          if (state.combo > state.maxCombo) {
            state.maxCombo = state.combo;
          }

          state.multiplier = getComboMultiplier(state.combo);

          // Activate specific powerups on special target hits
          if (target.type === 'magnet') {
            triggerPowerupEffect('magnet_field', targetPxX, targetPxY);
          } else if (target.type === 'comet') {
            triggerPowerupEffect('slow_time', targetPxX, targetPxY);
          } else if (target.type === 'golden_beacon' && Math.random() < 0.35) {
            triggerPowerupEffect('freeze', targetPxX, targetPxY);
          } else if (target.type === 'double_beacon' && Math.random() < 0.35) {
            triggerPowerupEffect('shield', targetPxX, targetPxY);
          }

          const bonusMultiplier = target.type === 'double_beacon' ? 2 : 1;
          const pointsGained = Math.round(target.points * state.multiplier * bonusMultiplier);
          state.score += pointsGained;

          const isMilestone = state.combo > 0 && state.combo % 5 === 0;

          if (isMilestone) {
            triggerHaptic('impact');
          } else if (target.type === 'golden_beacon' || target.type === 'double_beacon') {
            triggerHaptic('heavy');
          } else {
            triggerHaptic('light');
          }

          if (target.type === 'golden_beacon' || target.type === 'double_beacon') {
            state.goldenBeaconsHit++;
            audioManager.playBeacon();
            createExplosion(targetPxX, targetPxY, target.color, 24);
          } else {
            audioManager.playTap(state.combo);
            createExplosion(targetPxX, targetPxY, target.color, 16);
          }

          if (isMilestone) {
            state.floatingTexts.push(
              floatingTextPool.acquire(
                `fl_combo_${Date.now()}_${state.combo}`,
                `🔥 ${state.combo}x STREAK! (${state.multiplier}x BOOST)`,
                targetPxX,
                targetPxY - 26,
                '#00F5D4',
                1.5
              )
            );
          }

          state.floatingTexts.push(
            floatingTextPool.acquire(
              `fl_${Date.now()}_${Math.random()}`,
              state.multiplier > 1 ? `+${pointsGained} (${state.multiplier}x)` : `+${pointsGained}`,
              targetPxX,
              targetPxY,
              target.color,
              1 + state.multiplier * 0.1
            )
          );

          state.clickLogs.push({
            timestampMs: Math.round(nowOffset),
            xPct: tapXPct,
            yPct: tapYPct,
            type: 'hit',
            targetId: target.id,
            targetType: target.type,
            hit: true,
            scoreGained: pointsGained,
          });

          break;
        }
      }

      // MISS TAP (Tapping empty space)
      if (!hitFound) {
        state.misses++;
        state.score = Math.max(0, state.score - 25);
        state.combo = Math.max(0, state.combo - 1);
        state.multiplier = getComboMultiplier(state.combo);

        audioManager.playTap(1);
        triggerHaptic('selection');

        state.floatingTexts.push(
          floatingTextPool.acquire(`fl_miss_${Date.now()}`, `MISS (-25)`, touchX, touchY, '#FFB703', 1.1)
        );

        state.clickLogs.push({
          timestampMs: Math.round(nowOffset),
          xPct: tapXPct,
          yPct: tapYPct,
          type: 'miss',
          hit: false,
          scoreGained: -25,
        });
      }

      if (state.clickLogs.length === 1) {
        trackEvent('first_tap', { latencyMs: Math.round(nowOffset) });
      }

      // Update active powerups list for HUD telemetry
      const activeList: PowerupType[] = [];
      if (state.freezeTimeLeft > 0) activeList.push('freeze');
      if (state.shieldTimeLeft > 0) activeList.push('shield');
      if (state.speedBurstTimeLeft > 0) activeList.push('slow_time');
      if (state.magnetTimeLeft > 0) activeList.push('magnet_field');

      onScoreUpdate(state.score, state.combo, state.multiplier, activeList);
    },
    [isPlaying, isPaused, createExplosion, triggerPowerupEffect, onScoreUpdate, reduceMotion]
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      handleTap(touch.clientX, touch.clientY);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleTap(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying && !isPaused && onPauseChange) {
        onPauseChange(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, isPaused, onPauseChange]);

  // Main Render Loop: Forward Hyper-Speed Warp Flight, Powerup Particle Effects & Spaceship
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = canvas.parentElement;
      const cssW = parent?.clientWidth || window.innerWidth;
      const cssH = parent?.clientHeight || window.innerHeight;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    let lastFrameTimestamp = performance.now();
    const frameIntervalMs = 1000 / 60; // 60 FPS cap limit

    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);

      const deltaMs = currentTime - lastFrameTimestamp;
      if (deltaMs < frameIntervalMs - 1.5) {
        return; // Throttle to 60 FPS
      }
      lastFrameTimestamp = currentTime;

      const state = gameStateRef.current;
      const deltaTime = Math.min(deltaMs / 1000, 0.1);
      state.lastFrameTime = currentTime;

      // Update Powerup Durations
      if (state.freezeTimeLeft > 0) state.freezeTimeLeft = Math.max(0, state.freezeTimeLeft - deltaTime);
      if (state.shieldTimeLeft > 0) state.shieldTimeLeft = Math.max(0, state.shieldTimeLeft - deltaTime);
      if (state.speedBurstTimeLeft > 0) state.speedBurstTimeLeft = Math.max(0, state.speedBurstTimeLeft - deltaTime);
      if (state.magnetTimeLeft > 0) state.magnetTimeLeft = Math.max(0, state.magnetTimeLeft - deltaTime);

      performanceManager.registerFrame(deltaMs);
      const perfConfig = performanceManager.getConfig();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const shipX = width * 0.5 + state.shipSwayX;
      const shipY = height * 0.83 + Math.sin(currentTime * 0.003) * 4;

      if (isPlaying && !isPaused) {
        const elapsedMs = currentTime - state.roundStartTime;
        state.timeLeft = Math.max(0, state.roundDuration - elapsedMs / 1000);
        onTimeUpdate(Math.ceil(state.timeLeft));

        // Spawn scheduled targets
        while (
          nextTargetIndexRef.current < scheduledTargetsRef.current.length &&
          scheduledTargetsRef.current[nextTargetIndexRef.current].spawnTimeMs <= elapsedMs
        ) {
          const st = scheduledTargetsRef.current[nextTargetIndexRef.current];
          state.targets.push({
            id: st.id,
            type: st.type,
            category: st.category ?? getEntityCategory(st.type),
            x: st.xPct,
            y: st.yPct,
            vx: st.vxPct ?? 0,
            vy: st.vyPct ?? 0,
            radius: st.radius,
            rotation: 0,
            vRot: (Math.random() - 0.5) * 2.5,
            points: st.points,
            maxHp: st.maxHp || 1,
            hp: st.maxHp || 1,
            color: getTargetColor(st.type),
            spawnTimeMs: st.spawnTimeMs,
            spawnTime: state.roundStartTime + st.spawnTimeMs,
            lifespan: st.durationMs,
            pulsePhase: Math.random() * Math.PI * 2,
            speed: st.speed,
          });
          nextTargetIndexRef.current++;
        }

        // Freeze Slow-Motion Multiplier Factor
        const speedScale = state.freezeTimeLeft > 0 ? 0.35 : 1.0;

        // CATEGORY-BASED MOVEMENT PATTERNS
        for (let i = state.targets.length - 1; i >= 0; i--) {
          const target = state.targets[i];
          const category = target.category ?? getEntityCategory(target.type);

          target.rotation += target.vRot * deltaTime * speedScale;

          // Magnet Powerup Gravitational Pull Effect
          if (state.magnetTimeLeft > 0 && category !== 'hazard') {
            const targetPxX = (target.x / 100) * width;
            const targetPxY = (target.y / 100) * height;
            const mdx = shipX - targetPxX;
            const mdy = shipY - targetPxY;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist > 10 && mdist < 450) {
              target.vx += (mdx / mdist) * 22.0 * deltaTime;
              target.vy += (mdy / mdist) * 22.0 * deltaTime;
            }
          }

          if (category === 'collectible') {
            const waveX = Math.cos(currentTime * 0.003 + target.pulsePhase) * 14.0;
            const waveY = Math.sin(currentTime * 0.003 + target.pulsePhase) * 12.0;
            target.x += (target.vx + waveX) * deltaTime * speedScale;
            target.y += (target.vy + waveY) * deltaTime * speedScale;
          } else if (category === 'hazard') {
            if (Math.random() < 0.03) {
              target.vx += (Math.random() - 0.5) * 14.0;
              target.vy += (Math.random() - 0.5) * 14.0;
            }
            target.vx *= 0.992;
            target.vy *= 0.992;
            target.x += target.vx * deltaTime * speedScale;
            target.y += target.vy * deltaTime * speedScale;
          } else {
            target.x += target.vx * deltaTime * speedScale;
            target.y += target.vy * deltaTime * speedScale;
          }

          // Elastic Edge Bounce
          const minX = 10, maxX = 90, minY = 14, maxY = 78;
          if (target.x < minX) {
            target.x = minX;
            target.vx = -target.vx * 0.92;
            target.vRot += (Math.random() - 0.5) * 1.5;
          } else if (target.x > maxX) {
            target.x = maxX;
            target.vx = -target.vx * 0.92;
            target.vRot += (Math.random() - 0.5) * 1.5;
          }

          if (target.y < minY) {
            target.y = minY;
            target.vy = -target.vy * 0.92;
            target.vRot += (Math.random() - 0.5) * 1.5;
          } else if (target.y > maxY) {
            target.y = maxY;
            target.vy = -target.vy * 0.92;
            target.vRot += (Math.random() - 0.5) * 1.5;
          }

          const targetAgeMs = elapsedMs - (target.spawnTimeMs ?? (target.spawnTime - state.roundStartTime));
          if (targetAgeMs > target.lifespan) {
            state.targets.splice(i, 1);
          }
        }

        if (state.timeLeft <= 0) {
          const accuracy = state.totalTaps > 0 ? Math.round((state.hits / state.totalTaps) * 100) : 0;
          const effectiveRoundId = roundIdRef.current || (isDemoRef.current ? `demo_${Date.now()}` : '');
          const finalStats: RoundStats = {
            roundId: effectiveRoundId,
            score: state.score,
            rawScore: state.score,
            totalTaps: state.clickLogs.length,
            hits: state.hits,
            misses: state.misses,
            maxCombo: state.maxCombo,
            accuracy,
            minesHit: state.minesHit,
            goldenBeaconsHit: state.goldenBeaconsHit,
            powerupsUsed: state.powerupsUsed,
            duration: state.roundDuration,
            isDailySeed: Boolean(dailySeed),
            dailySeed,
            clickLogs: state.clickLogs,
          };
          onRoundComplete(finalStats);
          return;
        }
      }

      ctx.save();
      if (!reduceMotion && state.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * state.screenShake;
        const shakeY = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(shakeX, shakeY);
        state.screenShake = Math.max(0, state.screenShake - deltaTime * 40);
      }

      // Background Deep Space Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (backdropId === 'orion_nebula') {
        bgGrad.addColorStop(0, '#020512');
        bgGrad.addColorStop(0.6, '#04152a');
        bgGrad.addColorStop(1, '#003844');
      } else if (backdropId === 'saturn_rings') {
        bgGrad.addColorStop(0, '#100018');
        bgGrad.addColorStop(0.6, '#28002e');
        bgGrad.addColorStop(1, '#500028');
      } else {
        bgGrad.addColorStop(0, '#070414');
        bgGrad.addColorStop(0.6, '#120a2e');
        bgGrad.addColorStop(1, '#2a0230');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const vanishingX = width * 0.5;
      const vanishingY = height * 0.38;

      const warpSpeed = (800 + Math.min(state.combo, 25) * 120) * (reduceMotion ? 0.4 : 1.0) * (state.speedBurstTimeLeft > 0 ? 1.8 : 1.0);

      // 1. Draw Deep Space Galactic Nebula Clouds
      for (let i = 0; i < state.nebulaClouds.length; i++) {
        const neb = state.nebulaClouds[i];
        neb.z -= warpSpeed * 0.15 * deltaTime;
        if (neb.z <= 10) {
          neb.z = 900;
          neb.x = (Math.random() - 0.5) * 1200;
          neb.y = (Math.random() - 0.5) * 800;
        }

        const k = 400 / neb.z;
        const nebX = vanishingX + neb.x * k;
        const nebY = vanishingY + neb.y * k;
        const nebR = neb.radius * k;

        if (nebX + nebR > 0 && nebX - nebR < width && nebY + nebR > 0 && nebY - nebR < height) {
          const nebGrad = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, Math.max(1, nebR));
          nebGrad.addColorStop(0, neb.color);
          nebGrad.addColorStop(1, 'transparent');

          ctx.fillStyle = nebGrad;
          ctx.globalAlpha = Math.min(0.25, (1 - neb.z / 900) * neb.alpha);
          ctx.beginPath();
          ctx.arc(nebX, nebY, Math.max(1, nebR), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;

      // 2. 3D Perspective Hyper-Speed Warp Starfield
      ctx.lineWidth = state.speedBurstTimeLeft > 0 ? 3.0 : 1.5;
      for (let i = 0; i < state.warpStars.length; i++) {
        const star = state.warpStars[i];
        star.z -= warpSpeed * deltaTime;

        if (star.z <= 1) {
          star.z = 1000;
          star.x = (Math.random() - 0.5) * 1600;
          star.y = (Math.random() - 0.5) * 1200;
        }

        const kCurr = 400 / star.z;
        const currX = vanishingX + star.x * kCurr;
        const currY = vanishingY + star.y * kCurr;

        const prevZ = star.z + warpSpeed * deltaTime * (reduceMotion ? 1.0 : 2.5);
        const kPrev = 400 / prevZ;
        const prevX = vanishingX + star.x * kPrev;
        const prevY = vanishingY + star.y * kPrev;

        if (currX >= -50 && currX <= width + 50 && currY >= -50 && currY <= height + 50) {
          const alpha = Math.min(1, Math.max(0.1, (1000 - star.z) / 800));
          ctx.strokeStyle = state.speedBurstTimeLeft > 0 ? '#00F5D4' : star.color;
          ctx.globalAlpha = alpha;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(currX, currY);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;

      // RENDER SUPERNOVA MEGA-BOMB SHOCKWAVES
      for (let i = state.shockwaves.length - 1; i >= 0; i--) {
        const ring = state.shockwaves[i];
        ring.radius += deltaTime * 1200;
        ring.alpha = Math.max(0, 1 - ring.radius / ring.maxRadius);

        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 6.0;
        ctx.globalAlpha = ring.alpha;

        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (ring.radius >= ring.maxRadius) {
          state.shockwaves.splice(i, 1);
        }
      }
      ctx.globalAlpha = 1.0;

      // RENDER STASIS FROST MIST PARTICLES
      if (state.freezeTimeLeft > 0) {
        ctx.fillStyle = '#80FFEA';
        for (let i = 0; i < state.frostMist.length; i++) {
          const fm = state.frostMist[i];
          fm.x += fm.vx * deltaTime;
          fm.y += fm.vy * deltaTime;
          if (fm.y > height) fm.y = 0;
          if (fm.x < 0) fm.x = width;
          if (fm.x > width) fm.x = 0;

          ctx.globalAlpha = fm.alpha * (state.freezeTimeLeft / 6.0);
          ctx.fillRect(fm.x, fm.y, fm.size, fm.size);
        }
        ctx.globalAlpha = 1.0;
      }

      // RENDER GRAVITATIONAL MAGNET FIELD PULSE RINGS
      if (state.magnetTimeLeft > 0) {
        const pulseR = (currentTime * 0.2) % 180;
        ctx.strokeStyle = '#3A86FF';
        ctx.lineWidth = 2.0;
        ctx.globalAlpha = 0.5 * (state.magnetTimeLeft / 6.0);
        ctx.beginPath();
        ctx.arc(shipX, shipY, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // 3. RENDER ACTIVE TARGET OBJECTS WITH DISTINCT CATEGORY VISUALS
      const elapsedMs = currentTime - state.roundStartTime;
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        const category = target.category ?? getEntityCategory(target.type);
        const targetPxX = (target.x / 100) * width;
        const targetPxY = (target.y / 100) * height;

        const age = elapsedMs - (target.spawnTimeMs ?? (target.spawnTime - state.roundStartTime));
        const growProgress = Math.min(1, Math.max(0, age) / 350);
        const targetScale = 0.3 + 0.7 * growProgress;

        ctx.save();
        ctx.translate(targetPxX, targetPxY);
        ctx.rotate(target.rotation);
        ctx.scale(targetScale, targetScale);

        if (category === 'collectible') {
          const pulse = Math.sin(currentTime * 0.01 + target.pulsePhase) * 4;

          ctx.fillStyle = target.color;
          if (perfConfig.enableGlowBlur) {
            ctx.shadowColor = target.color;
            ctx.shadowBlur = perfConfig.glowBlurRadius * 1.5;
          }

          ctx.beginPath();
          ctx.arc(0, 0, target.radius + pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.moveTo(0, -target.radius * 0.7);
          ctx.lineTo(target.radius * 0.5, 0);
          ctx.lineTo(0, target.radius * 0.7);
          ctx.lineTo(-target.radius * 0.5, 0);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius * 1.25, 0, Math.PI * 2);
          ctx.stroke();
        } else if (category === 'hazard') {
          const pulse = Math.sin(currentTime * 0.015) * 6;

          ctx.fillStyle = target.color;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2.5;

          if (target.type === 'black_hole') {
            ctx.fillStyle = '#0B071E';
            ctx.strokeStyle = '#7000FF';
            ctx.beginPath();
            ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = '#FF0054';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, target.radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();
          } else if (target.type === 'decoy_satellite') {
            ctx.fillStyle = '#FF3300';
            ctx.fillRect(-18, -12, 36, 24);
            ctx.strokeRect(-18, -12, 36, 24);
            ctx.fillStyle = '#1D3557';
            ctx.fillRect(-34, -6, 14, 12);
            ctx.fillRect(20, -6, 14, 12);
          } else {
            ctx.beginPath();
            const spikes = 8;
            for (let s = 0; s < spikes * 2; s++) {
              const angle = (Math.PI / spikes) * s;
              const r = s % 2 === 0 ? target.radius * 1.15 : target.radius * 0.65;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              if (s === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          ctx.strokeStyle = '#FF0054';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius + 8 + pulse, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          if (target.type === 'boss_meteor') {
            ctx.fillStyle = '#FB8500';
            if (perfConfig.enableGlowBlur) {
              ctx.shadowColor = '#FB8500';
              ctx.shadowBlur = perfConfig.glowBlurRadius * 2;
            }

            ctx.beginPath();
            ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#FF0054';
            ctx.lineWidth = 3;
            ctx.stroke();

            const maxHp = target.maxHp || 3;
            const currentHp = target.hp;
            const pipWidth = 8;
            const startX = -((maxHp * (pipWidth + 3)) / 2);
            for (let h = 0; h < maxHp; h++) {
              ctx.fillStyle = h < currentHp ? '#00F5D4' : '#444';
              ctx.fillRect(startX + h * (pipWidth + 3), -target.radius - 12, pipWidth, 4);
            }
          } else {
            ctx.fillStyle = target.color || '#9D4EDD';
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 2;

            ctx.beginPath();
            const pointsCount = 7;
            for (let p = 0; p < pointsCount; p++) {
              const angle = (Math.PI * 2 * p) / pointsCount;
              const r = target.radius * (0.82 + Math.sin(p * 2.5) * 0.18);
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              if (p === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.arc(-target.radius * 0.3, -target.radius * 0.2, target.radius * 0.25, 0, Math.PI * 2);
            ctx.arc(target.radius * 0.3, target.radius * 0.3, target.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // 4. Render Laser Beam Flashes on Tap
      for (let i = state.laserFlashes.length - 1; i >= 0; i--) {
        const lf = state.laserFlashes[i];
        lf.alpha -= deltaTime * 4.0;
        if (lf.alpha <= 0) {
          state.laserFlashes.splice(i, 1);
          continue;
        }

        ctx.strokeStyle = shipColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = lf.alpha;

        ctx.beginPath();
        ctx.moveTo(shipX - 18, shipY - 10);
        ctx.lineTo(lf.x, lf.y);
        ctx.moveTo(shipX + 18, shipY - 10);
        ctx.lineTo(lf.x, lf.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 5. RENDER EQUIPPED USER SPACESHIP WITH THRUSTERS, SPEED-BURST FLARE & PLASMA SHIELD
      state.shipSwayX += (state.targetShipSwayX - state.shipSwayX) * 0.1;
      state.shipBankAngle = (state.targetShipSwayX - state.shipSwayX) * 0.0008;

      // Spawn Engine Exhaust Trail Particles
      if (Math.random() < 0.8 || state.speedBurstTimeLeft > 0) {
        state.engineParticles.push({
          x: shipX + (Math.random() - 0.5) * 16,
          y: shipY + 22,
          vx: (Math.random() - 0.5) * 30,
          vy: (state.speedBurstTimeLeft > 0 ? 250 : 120) + Math.random() * 100,
          size: (state.speedBurstTimeLeft > 0 ? 5 : 3) + Math.random() * 3,
          color: state.speedBurstTimeLeft > 0 ? '#00F5D4' : Math.random() > 0.5 ? shipColor : shipAccentColor,
          life: 0,
          maxLife: state.speedBurstTimeLeft > 0 ? 0.5 : 0.35,
        });
      }

      for (let i = state.engineParticles.length - 1; i >= 0; i--) {
        const ep = state.engineParticles[i];
        ep.x += ep.vx * deltaTime;
        ep.y += ep.vy * deltaTime;
        ep.life += deltaTime;
        const alpha = Math.max(0, 1 - ep.life / ep.maxLife);

        ctx.fillStyle = ep.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(ep.x, ep.y, ep.size, ep.size);

        if (ep.life >= ep.maxLife) {
          state.engineParticles.splice(i, 1);
        }
      }
      ctx.globalAlpha = 1.0;

      // Render Spaceship Hull & Engines
      ctx.save();
      ctx.translate(shipX, shipY);
      ctx.rotate(state.shipBankAngle);

      const pulseEngine = Math.sin(currentTime * 0.02) * 4;
      const thrusterGrad = ctx.createLinearGradient(0, 15, 0, (state.speedBurstTimeLeft > 0 ? 60 : 42) + pulseEngine);
      thrusterGrad.addColorStop(0, '#FFFFFF');
      thrusterGrad.addColorStop(0.3, state.speedBurstTimeLeft > 0 ? '#00F5D4' : shipColor);
      thrusterGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = thrusterGrad;
      ctx.beginPath();
      ctx.moveTo(-10, 18);
      ctx.lineTo(0, (state.speedBurstTimeLeft > 0 ? 60 : 42) + pulseEngine);
      ctx.lineTo(10, 18);
      ctx.closePath();
      ctx.fill();

      if (shipId === 'ship_retro_shuttle') {
        ctx.fillStyle = shipColor;
        ctx.strokeStyle = shipAccentColor;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -32);
        ctx.lineTo(16, 8);
        ctx.lineTo(24, 18);
        ctx.lineTo(10, 22);
        ctx.lineTo(0, 18);
        ctx.lineTo(-10, 22);
        ctx.lineTo(-24, 18);
        ctx.lineTo(-16, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4, -14, 8, 12);
      } else if (shipId === 'ship_neon_falcon') {
        ctx.fillStyle = shipColor;
        ctx.strokeStyle = shipAccentColor;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -36);
        ctx.lineTo(22, -8);
        ctx.lineTo(14, 20);
        ctx.lineTo(0, 14);
        ctx.lineTo(-14, 20);
        ctx.lineTo(-22, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00F5D4';
        ctx.beginPath();
        ctx.arc(0, -4, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (shipId === 'ship_plasma_crusher') {
        ctx.fillStyle = shipColor;
        ctx.strokeStyle = shipAccentColor;
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(26, -10);
        ctx.lineTo(20, 22);
        ctx.lineTo(10, 16);
        ctx.lineTo(0, 24);
        ctx.lineTo(-10, 16);
        ctx.lineTo(-20, 22);
        ctx.lineTo(-26, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FF0054';
        ctx.beginPath();
        ctx.arc(0, -8, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = shipColor;
        ctx.strokeStyle = shipAccentColor;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(24, 14);
        ctx.lineTo(12, 18);
        ctx.lineTo(0, 10);
        ctx.lineTo(-12, 18);
        ctx.lineTo(-24, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(0, -10, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#00F5D4';
      ctx.beginPath();
      ctx.arc(-22, 12, 2.5, 0, Math.PI * 2);
      ctx.arc(22, 12, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // RENDER ROTATING 3D PLASMA SHIELD BUBBLE
      if (state.shieldTimeLeft > 0) {
        state.shieldAngle += deltaTime * 3.0;
        ctx.rotate(state.shieldAngle);
        ctx.strokeStyle = '#00F5D4';
        ctx.lineWidth = 3.0;
        ctx.shadowColor = '#00F5D4';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        const hexSides = 6;
        const shieldR = 46;
        for (let h = 0; h < hexSides; h++) {
          const ha = (Math.PI * 2 * h) / hexSides;
          const hx = Math.cos(ha) * shieldR;
          const hy = Math.sin(ha) * shieldR;
          if (h === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // 6. Render Explosions & Tap Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life += deltaTime;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(p.x, p.y, p.size, p.size);

        if (p.life >= p.maxLife) {
          const dead = state.particles.splice(i, 1)[0];
          particlePool.release(dead);
        }
      }
      ctx.globalAlpha = 1.0;

      // 7. Render Floating Score Text
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 40 * deltaTime;
        ft.life += deltaTime;
        ft.alpha = Math.max(0, 1 - ft.life / 1.2);

        ctx.save();
        ctx.font = 'bold 16px "Press Start 2P", monospace';
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = ft.alpha;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();

        if (ft.life >= 1.2) {
          const dead = state.floatingTexts.splice(i, 1)[0];
          floatingTextPool.release(dead);
        }
      }
      ctx.globalAlpha = 1.0;

      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    isPlaying,
    isPaused,
    shipId,
    shipColor,
    shipAccentColor,
    backdropId,
    reduceMotion,
    onTimeUpdate,
    onRoundComplete,
    dailySeed,
  ]);

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`w-full h-full block touch-none select-none ${
        crtIntensity === 'high' ? 'filter contrast-125 brightness-110' : ''
      }`}
    />
  );
};
