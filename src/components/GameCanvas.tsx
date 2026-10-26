import React, { useRef, useEffect, useCallback } from 'react';
import { Target, Particle, FloatingText, TargetType, PowerupType, RoundStats, ClickLog } from '../types/game';
import { generateRoundTargets, getTargetColor, SharedTarget } from '../shared/targetGenerator';
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
    activePowerups: {
      freeze: 0,
      shield: 0,
    },
    screenShake: 0,
    gridOffset: 0,
    lastFrameTime: performance.now(),

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

  // Reset State and Initialize Scheduled Targets on Round Start
  const startRound = useCallback(() => {
    const now = performance.now();

    // Recycle active particles & floating texts back to pool before starting
    const state = gameStateRef.current;
    state.particles.forEach((p) => particlePool.release(p));
    state.floatingTexts.forEach((ft) => floatingTextPool.release(ft));

    init3DSpaceEnvironment();

    // Resolve authoritative seed for simulation
    const effectiveSeed = (seed || dailySeed || (isDemo ? `demo_${Date.now()}` : `norm_${Date.now()}`)).trim();
    effectiveSeedRef.current = effectiveSeed;

    // Generate deterministic target schedule matching server model
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
      activePowerups: {
        freeze: 0,
        shield: 0,
      },
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
      // Clean up on round end / exit to prevent leaks
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

      // Sway ship toward tap location
      state.targetShipSwayX = (touchX - cssWidth / 2) * 0.35;

      // Laser flash visual effect
      state.laserFlashes.push({ x: touchX, y: touchY, alpha: 1.0 });

      const nowOffset = performance.now() - state.roundStartTime;
      const tapXPct = Number(((touchX / cssWidth) * 100).toFixed(1));
      const tapYPct = Number(((touchY / cssHeight) * 100).toFixed(1));
      let hitFound = false;

      // Check hit against targets in reverse render order (top-most first)
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        const targetPxX = (target.x / 100) * cssWidth;
        const targetPxY = (target.y / 100) * cssHeight;

        const dx = touchX - targetPxX;
        const dy = touchY - targetPxY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Hit detection radius
        if (dist <= target.radius + 20) {
          hitFound = true;
          state.hits++;

          // Boss meteor multi-hit handling
          if (target.type === 'boss_meteor') {
            if (target.hp > 1) {
              target.hp -= 1;
              state.score += 100;
              audioManager.playTap(state.multiplier);
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
              // Defeated on final blow
              state.targets.splice(i, 1);
              state.combo++;
              if (state.combo > state.maxCombo) state.maxCombo = state.combo;
              const comboMultiplier = 1 + Math.floor(state.combo / 5) * 0.25;
              state.multiplier = comboMultiplier;
              const pointsGained = Math.round(target.points * comboMultiplier);
              state.score += pointsGained;
              state.bossesDefeated++;
              createExplosion(targetPxX, targetPxY, target.color, 28);
              audioManager.playBeacon();

              const isMilestone = state.combo > 0 && state.combo % 10 === 0;
              if (isMilestone) {
                triggerHaptic('impact');
              } else {
                triggerHaptic('heavy');
              }

              if (isMilestone) {
                state.floatingTexts.push(
                  floatingTextPool.acquire(
                    `fl_combo_${Date.now()}_${state.combo}`,
                    `🔥 ${state.combo}x COMBO MILESTONE!`,
                    targetPxX,
                    targetPxY - 26,
                    '#00F5D4',
                    1.6
                  )
                );
              }
              state.floatingTexts.push(
                floatingTextPool.acquire(
                  `fl_${Date.now()}_${Math.random()}`,
                  `👑 BOSS DEFEATED! +${pointsGained}`,
                  targetPxX,
                  targetPxY,
                  '#FB8500',
                  1.8
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

          // Standard targets
          state.targets.splice(i, 1);

          if (target.type === 'mine' || target.type === 'black_hole') {
            if (target.type === 'mine') state.minesHit++;
            if (target.type === 'black_hole') state.blackHolesHit++;

            state.combo = 0;
            state.multiplier = 1;
            const penalty = target.points;
            state.score = Math.max(0, state.score + penalty);
            if (!reduceMotion) {
              state.screenShake = 16;
            }
            audioManager.playMine();
            triggerHaptic('error');
            createExplosion(targetPxX, targetPxY, target.color, 22);

            state.floatingTexts.push(
              floatingTextPool.acquire(
                `fl_${Date.now()}_${Math.random()}`,
                `${target.type === 'mine' ? '💥 DANGER MINE!' : '🌌 BLACK HOLE!'} ${penalty}`,
                targetPxX,
                targetPxY,
                target.color,
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
              scoreGained: penalty,
            });
          } else {
            // Positive targets
            state.combo++;
            if (state.combo > state.maxCombo) {
              state.maxCombo = state.combo;
            }

            const comboMultiplier = 1 + Math.floor(state.combo / 5) * 0.25;
            state.multiplier = comboMultiplier;

            const bonusMultiplier = target.type === 'double_beacon' ? 2 : 1;
            const pointsGained = Math.round(target.points * comboMultiplier * bonusMultiplier);
            state.score += pointsGained;

            const isMilestone = state.combo > 0 && state.combo % 10 === 0;

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
              audioManager.playTap(comboMultiplier);
              createExplosion(targetPxX, targetPxY, target.color, 16);
            }

            if (isMilestone) {
              state.floatingTexts.push(
                floatingTextPool.acquire(
                  `fl_combo_${Date.now()}_${state.combo}`,
                  `🔥 ${state.combo}x COMBO MILESTONE!`,
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
                comboMultiplier > 1 ? `+${pointsGained} (x${comboMultiplier.toFixed(2)})` : `+${pointsGained}`,
                targetPxX,
                targetPxY,
                target.color,
                1 + comboMultiplier * 0.1
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
          }

          break;
        }
      }

      if (!hitFound) {
        state.misses++;
        state.combo = 0;
        state.multiplier = 1;
        audioManager.playTap(1);
        triggerHaptic('selection');

        state.clickLogs.push({
          timestampMs: Math.round(nowOffset),
          xPct: tapXPct,
          yPct: tapYPct,
          type: 'miss',
          hit: false,
          scoreGained: 0,
        });
      }

      if (state.clickLogs.length === 1) {
        trackEvent('first_tap', { latencyMs: Math.round(nowOffset) });
      }

      onScoreUpdate(state.score, state.combo, state.multiplier, []);
    },
    [isPlaying, isPaused, createExplosion, onScoreUpdate, reduceMotion]
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

  // Main Render Loop: Forward Hyper-Speed Warp Flight & Equipped Spaceship Rendering
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

      performanceManager.registerFrame(deltaMs);
      const perfConfig = performanceManager.getConfig();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isPlaying && !isPaused) {
        const elapsedMs = currentTime - state.roundStartTime;
        state.timeLeft = Math.max(0, state.roundDuration - elapsedMs / 1000);
        onTimeUpdate(Math.ceil(state.timeLeft));

        // Deterministic target spawning based on scheduled timestamp
        while (
          nextTargetIndexRef.current < scheduledTargetsRef.current.length &&
          scheduledTargetsRef.current[nextTargetIndexRef.current].spawnTimeMs <= elapsedMs
        ) {
          const st = scheduledTargetsRef.current[nextTargetIndexRef.current];
          state.targets.push({
            id: st.id,
            type: st.type,
            x: st.xPct,
            y: st.yPct,
            vx: 0,
            vy: 0,
            radius: st.radius,
            rotation: 0,
            vRot: 0,
            points: st.points,
            maxHp: st.maxHp || 1,
            hp: st.maxHp || 1,
            color: getTargetColor(st.type),
            spawnTimeMs: st.spawnTimeMs,
            spawnTime: state.roundStartTime + st.spawnTimeMs,
            lifespan: st.durationMs,
            pulsePhase: 0,
            speed: st.speed,
          });
          nextTargetIndexRef.current++;
        }

        // Despawn expired targets
        for (let i = state.targets.length - 1; i >= 0; i--) {
          const target = state.targets[i];
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

      // Vanishing point center for forward 3D space warp flight
      const vanishingX = width * 0.5;
      const vanishingY = height * 0.38;

      // Warp Speed Flight Factor (Accelerates with combo)
      const warpSpeed = (800 + Math.min(state.combo, 25) * 120) * (reduceMotion ? 0.4 : 1.0);

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

      // 2. 3D Perspective Hyper-Speed Warp Starfield (Speed Lines)
      ctx.lineWidth = 1.5;
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

        // Trail length projected from previous frame position
        const prevZ = star.z + warpSpeed * deltaTime * (reduceMotion ? 1.0 : 2.5);
        const kPrev = 400 / prevZ;
        const prevX = vanishingX + star.x * kPrev;
        const prevY = vanishingY + star.y * kPrev;

        if (currX >= -50 && currX <= width + 50 && currY >= -50 && currY <= height + 50) {
          const alpha = Math.min(1, Math.max(0.1, (1000 - star.z) / 800));
          ctx.strokeStyle = star.color;
          ctx.globalAlpha = alpha;

          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(currX, currY);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;

      // 3. 3D Synth Grid Horizon
      state.gridOffset = (state.gridOffset + deltaTime * (state.multiplier >= 2 ? 140 : 80)) % perfConfig.gridStep;
      ctx.strokeStyle = state.multiplier >= 2 ? '#00F5D4' : '#9D4EDD';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4;

      const numGridRadial = 12;
      for (let r = -numGridRadial; r <= numGridRadial; r++) {
        const targetX = width / 2 + (r * width) / (numGridRadial * 0.5);
        ctx.beginPath();
        ctx.moveTo(vanishingX, vanishingY);
        ctx.lineTo(targetX, height);
        ctx.stroke();
      }

      // Moving Grid Bars
      for (let yPct = 0.05; yPct <= 1.0; yPct += 0.08) {
        const yPos = vanishingY + Math.pow(yPct, 2) * (height - vanishingY);
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(width, yPos);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 4. Render Active Target Objects
      const elapsedMs = currentTime - state.roundStartTime;
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        const targetPxX = (target.x / 100) * width;
        const targetPxY = (target.y / 100) * height;

        const age = elapsedMs - (target.spawnTimeMs ?? (target.spawnTime - state.roundStartTime));
        const growProgress = Math.min(1, Math.max(0, age) / 250);
        const targetScale = 0.2 + 0.8 * growProgress;

        ctx.save();
        ctx.translate(targetPxX, targetPxY);
        ctx.scale(targetScale, targetScale);

        if (target.type === 'mine') {
          ctx.fillStyle = '#FF0054';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;

          ctx.beginPath();
          const spikes = 8;
          for (let s = 0; s < spikes * 2; s++) {
            const angle = (Math.PI / spikes) * s;
            const r = s % 2 === 0 ? target.radius * 1.1 : target.radius * 0.65;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (target.type === 'black_hole') {
          ctx.fillStyle = '#0B071E';
          ctx.strokeStyle = '#7000FF';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#00F5D4';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (target.type === 'golden_beacon') {
          ctx.fillStyle = '#FFB703';
          if (perfConfig.enableGlowBlur) {
            ctx.shadowColor = '#FFB703';
            ctx.shadowBlur = perfConfig.glowBlurRadius * 1.5;
          }

          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (target.type === 'double_beacon') {
          ctx.fillStyle = '#8338EC';
          if (perfConfig.enableGlowBlur) {
            ctx.shadowColor = '#8338EC';
            ctx.shadowBlur = perfConfig.glowBlurRadius * 1.5;
          }

          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.strokeStyle = '#00F5D4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius * 1.25, 0, Math.PI * 2);
          ctx.stroke();
        } else if (target.type === 'comet') {
          ctx.fillStyle = '#00F5D4';
          if (perfConfig.enableGlowBlur) {
            ctx.shadowColor = '#00F5D4';
            ctx.shadowBlur = perfConfig.glowBlurRadius;
          }

          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (target.type === 'magnet') {
          ctx.fillStyle = '#3A86FF';
          if (perfConfig.enableGlowBlur) {
            ctx.shadowColor = '#3A86FF';
            ctx.shadowBlur = perfConfig.glowBlurRadius;
          }

          ctx.beginPath();
          ctx.arc(0, 0, target.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, target.radius * 0.7, 0, Math.PI);
          ctx.stroke();
        } else if (target.type === 'boss_meteor') {
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

          // HP indicators above boss
          const maxHp = target.maxHp || 3;
          const currentHp = target.hp;
          const pipWidth = 8;
          const startX = -((maxHp * (pipWidth + 3)) / 2);
          for (let h = 0; h < maxHp; h++) {
            ctx.fillStyle = h < currentHp ? '#00F5D4' : '#444';
            ctx.fillRect(startX + h * (pipWidth + 3), -target.radius - 12, pipWidth, 4);
          }
        } else {
          // Standard asteroid
          ctx.fillStyle = target.color || '#9D4EDD';
          ctx.strokeStyle = '#222';
          ctx.lineWidth = 2;

          ctx.beginPath();
          const pointsCount = 6;
          for (let p = 0; p < pointsCount; p++) {
            const angle = (Math.PI * 2 * p) / pointsCount;
            const r = target.radius * (0.8 + Math.sin(p * 3) * 0.2);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Render Laser Beam Flashes on Tap
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

        const currentShipX = width * 0.5 + state.shipSwayX;
        const currentShipY = height * 0.83;

        ctx.beginPath();
        ctx.moveTo(currentShipX - 18, currentShipY - 10);
        ctx.lineTo(lf.x, lf.y);
        ctx.moveTo(currentShipX + 18, currentShipY - 10);
        ctx.lineTo(lf.x, lf.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // 6. RENDER EQUIPPED USER SPACESHIP WITH THRUSTERS & PARTICLES
      // Smoothly interpolate ship sway and banking
      state.shipSwayX += (state.targetShipSwayX - state.shipSwayX) * 0.1;
      state.shipBankAngle = (state.targetShipSwayX - state.shipSwayX) * 0.0008;

      const shipX = width * 0.5 + state.shipSwayX;
      const shipY = height * 0.83 + Math.sin(currentTime * 0.003) * 4;

      // Spawn Engine Exhaust Trail Particles
      if (Math.random() < 0.8) {
        state.engineParticles.push({
          x: shipX + (Math.random() - 0.5) * 16,
          y: shipY + 22,
          vx: (Math.random() - 0.5) * 30,
          vy: 120 + Math.random() * 100,
          size: Math.random() * 4 + 2,
          color: Math.random() > 0.5 ? shipColor : shipAccentColor,
          life: 0,
          maxLife: 0.35,
        });
      }

      // Render & Update Engine Particles
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

      // Glowing Rear Engine Plumes
      const pulseEngine = Math.sin(currentTime * 0.02) * 4;
      const thrusterGrad = ctx.createLinearGradient(0, 15, 0, 45 + pulseEngine);
      thrusterGrad.addColorStop(0, '#FFFFFF');
      thrusterGrad.addColorStop(0.3, shipColor);
      thrusterGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = thrusterGrad;
      ctx.beginPath();
      ctx.moveTo(-10, 18);
      ctx.lineTo(0, 42 + pulseEngine);
      ctx.lineTo(10, 18);
      ctx.closePath();
      ctx.fill();

      // Render Ship Model Silhouette based on shipId
      if (shipId === 'ship_retro_shuttle') {
        // Retro 80s Shuttle
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

        // Cockpit
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4, -14, 8, 12);
      } else if (shipId === 'ship_neon_falcon') {
        // Neon Falcon
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

        // Energy Core
        ctx.fillStyle = '#00F5D4';
        ctx.beginPath();
        ctx.arc(0, -4, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (shipId === 'ship_plasma_crusher') {
        // Heavy Plasma Crusher
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

        // Crimson Cockpit Gem
        ctx.fillStyle = '#FF0054';
        ctx.beginPath();
        ctx.arc(0, -8, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Cyber Wing (Standard Starfighter)
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

        // Cockpit Glass
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(0, -10, 4, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wingtip Navigation Lights
      ctx.fillStyle = '#00F5D4';
      ctx.beginPath();
      ctx.arc(-22, 12, 2.5, 0, Math.PI * 2);
      ctx.arc(22, 12, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 7. Render Explosions & Tap Particles
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

      // 8. Render Floating Score Text
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
