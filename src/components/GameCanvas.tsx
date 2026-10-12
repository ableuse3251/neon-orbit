import React, { useRef, useEffect, useCallback } from 'react';
import { Target, Particle, FloatingText, TargetType, PowerupType, RoundStats, ClickLog } from '../types/game';
import { particlePool, floatingTextPool } from '../utils/pool';
import { performanceManager } from '../utils/performance';
import { audioManager } from '../utils/audio';
import { triggerHaptic } from '../utils/telegram';

interface GameCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  shipColor: string;
  trailType: string;
  backdropId: string;
  crtIntensity: 'off' | 'low' | 'high';
  reduceMotion?: boolean;
  dailySeed?: string;
  roundId?: string;
  seed?: string;
  onPauseChange?: (paused: boolean) => void;
  onScoreUpdate: (score: number, combo: number, multiplier: number, activePowerups: PowerupType[]) => void;
  onRoundComplete: (stats: RoundStats) => void;
  onTimeUpdate: (timeLeft: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isPlaying,
  isPaused,
  shipColor,
  trailType,
  backdropId,
  crtIntensity,
  reduceMotion = false,
  dailySeed,
  onPauseChange,
  onScoreUpdate,
  onRoundComplete,
  onTimeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    targetSpawnTimer: 0,
  });

  // Seeded Random for Daily Challenge
  const seedRef = useRef<number>(123456);
  const seededRandom = useCallback(() => {
    if (!dailySeed) return Math.random();
    seedRef.current = (seedRef.current * 9301 + 49297) % 233280;
    return seedRef.current / 233280;
  }, [dailySeed]);

  useEffect(() => {
    if (dailySeed) {
      let hash = 0;
      for (let i = 0; i < dailySeed.length; i++) {
        hash = (hash << 5) - hash + dailySeed.charCodeAt(i);
        hash |= 0;
      }
      seedRef.current = Math.abs(hash) || 123456;
    }
  }, [dailySeed]);

  // Reset State on Round Start
  const startRound = useCallback(() => {
    const now = performance.now();
    
    // Recycle active particles & floating texts back to pool before starting
    const state = gameStateRef.current;
    state.particles.forEach((p) => particlePool.release(p));
    state.floatingTexts.forEach((ft) => floatingTextPool.release(ft));

    gameStateRef.current = {
      roundStartTime: now,
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
      targetSpawnTimer: 0,
    };

    onScoreUpdate(0, 0, 1, []);
    onTimeUpdate(45);
  }, [onScoreUpdate, onTimeUpdate]);

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

  // Spawn Target Helper
  const spawnTarget = useCallback((width: number, height: number) => {
    const rand = seededRandom();
    let type: TargetType = 'asteroid';
    let points = 100;
    let radius = 28;
    let lifespan = 2500;
    let color = '#9D4EDD';
    let maxHp = 1;

    if (rand < 0.08) {
      type = 'golden_beacon';
      points = 300;
      radius = 22;
      lifespan = 2000;
      color = '#FFB703';
    } else if (rand < 0.16) {
      type = 'double_beacon';
      points = 450;
      radius = 23;
      lifespan = 1900;
      color = '#8338EC';
    } else if (rand < 0.28) {
      type = 'comet';
      points = 200;
      radius = 24;
      lifespan = 1800;
      color = '#00F5D4';
    } else if (rand < 0.38) {
      type = 'magnet';
      points = 250;
      radius = 25;
      lifespan = 2200;
      color = '#3A86FF';
    } else if (rand < 0.52) {
      type = 'mine';
      points = -150;
      radius = 26;
      lifespan = 3000;
      color = '#FF0054';
    } else if (rand < 0.60) {
      type = 'black_hole';
      points = -250;
      radius = 32;
      lifespan = 3500;
      color = '#1D3557';
    } else if (rand < 0.65) {
      type = 'boss_meteor';
      points = 800;
      radius = 42;
      lifespan = 5000;
      color = '#FB8500';
      maxHp = 3;
    }

    // Normalized coordinates (10% to 90% horizontal, 15% to 80% vertical)
    const xPct = 10 + seededRandom() * 80;
    const yPct = 15 + seededRandom() * 65;

    const newTarget: Target = {
      id: `t_${Date.now()}_${Math.random()}`,
      type,
      x: xPct,
      y: yPct,
      vx: 0,
      vy: 0,
      radius,
      rotation: 0,
      vRot: 0,
      points,
      maxHp,
      hp: maxHp,
      color,
      spawnTime: performance.now(),
      lifespan,
      pulsePhase: 0,
    };

    gameStateRef.current.targets.push(newTarget);
  }, [seededRandom]);

  // Explosion Particle Spawner (using Particle Pool)
  const createExplosion = useCallback((x: number, y: number, color: string, baseCount = 18) => {
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
  }, [reduceMotion]);

  // Trigger Powerup
  const triggerPowerup = useCallback((type: PowerupType) => {
    const state = gameStateRef.current;
    state.powerupsUsed.push(type);

      const canvas = canvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cW = canvas ? canvas.width / dpr : window.innerWidth;
      const cH = canvas ? canvas.height / dpr : window.innerHeight;

      if (type === 'freeze') {
        state.activePowerups.freeze = performance.now() + 5000;
        audioManager.playFreeze();
        triggerHaptic('success');
        state.floatingTexts.push(
          floatingTextPool.acquire(`pw_${Date.now()}`, '❄️ TIME FREEZE! (5s)', cW / 2, cH * 0.3, '#00F5D4', 1.5)
        );
      } else if (type === 'supernova') {
        audioManager.playSupernova();
        triggerHaptic('heavy');
        if (!reduceMotion) {
          state.screenShake = 18;
        }

        let scoreGained = 0;
        state.targets.forEach((t) => {
          if (t.type !== 'mine') {
            scoreGained += t.points * state.multiplier;
            const px = (t.x / 100) * cW;
            const py = (t.y / 100) * cH;
            createExplosion(px, py, t.color, 24);
          }
        });
        state.targets = [];

      state.score += scoreGained;
      state.floatingTexts.push(
        floatingTextPool.acquire(`pw_${Date.now()}`, `💥 SUPERNOVA! +${scoreGained}`, window.innerWidth / 2, window.innerHeight * 0.3, '#FF0054', 1.8)
      );
    } else if (type === 'shield') {
      state.activePowerups.shield = 1;
      audioManager.playShield();
      triggerHaptic('medium');
      state.floatingTexts.push(
        floatingTextPool.acquire(`pw_${Date.now()}`, '🛡️ SHIELD ACTIVE!', window.innerWidth / 2, window.innerHeight * 0.3, '#FFB703', 1.5)
      );
    }
  }, [createExplosion, reduceMotion]);

  // Handle Multi-touch and Tap Interactions
  const handleTap = useCallback((clientX: number, clientY: number) => {
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

    const nowOffset = performance.now() - state.roundStartTime;
    let hitFound = false;

    // Check hit against targets in reverse render order
    for (let i = state.targets.length - 1; i >= 0; i--) {
      const target = state.targets[i];
      const targetPxX = (target.x / 100) * cssWidth;
      const targetPxY = (target.y / 100) * cssHeight;

      const dx = touchX - targetPxX;
      const dy = touchY - targetPxY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Large hit detection radius (target radius + generous touch margin)
      if (dist <= target.radius + 18) {
        hitFound = true;
        state.hits++;
        state.targets.splice(i, 1);

        if (target.type === 'mine') {
          state.minesHit++;
          if (state.activePowerups.shield > 0) {
            state.activePowerups.shield = 0;
            audioManager.playShield();
            triggerHaptic('warning');
            createExplosion(targetPxX, targetPxY, '#FFB703', 20);

            state.floatingTexts.push(
              floatingTextPool.acquire(`fl_${Date.now()}`, '🛡️ SHIELD ABSORBED!', targetPxX, targetPxY, '#FFB703', 1.2)
            );
          } else {
            state.combo = 0;
            state.multiplier = 1;
            state.score = Math.max(0, state.score - 200);
            if (!reduceMotion) {
              state.screenShake = 16;
            }
            audioManager.playMine();
            triggerHaptic('error');
            createExplosion(targetPxX, targetPxY, '#FF0054', 22);

            state.floatingTexts.push(
              floatingTextPool.acquire(`fl_${Date.now()}`, '💥 DANGER MINE! -200', targetPxX, targetPxY, '#FF0054', 1.3)
            );
          }

          state.clickLogs.push({
            timestampMs: nowOffset,
            xPct: (touchX / cssWidth) * 100,
            yPct: (touchY / cssHeight) * 100,
            type: 'hit',
            timestamp: nowOffset,
            targetId: target.id,
            targetType: 'mine',
            x: touchX,
            y: touchY,
            hit: true,
            scoreGained: -200,
          });
        } else {
          state.combo++;
          if (state.combo > state.maxCombo) {
            state.maxCombo = state.combo;
          }

          const prevMultiplier = state.multiplier;
          if (state.combo >= 20) state.multiplier = 5;
          else if (state.combo >= 12) state.multiplier = 3;
          else if (state.combo >= 5) state.multiplier = 2;
          else state.multiplier = 1;

          if (state.multiplier > prevMultiplier) {
            audioManager.playHyperMode();
            triggerHaptic('success');
            state.floatingTexts.push(
              floatingTextPool.acquire(`hm_${Date.now()}`, `🔥 HYPERMODE x${state.multiplier}!`, cssWidth / 2, cssHeight * 0.25, '#00F5D4', 1.6)
            );
          }

          const pointsGained = target.points * state.multiplier;
          state.score += pointsGained;

          if (target.type === 'golden_beacon') {
            state.goldenBeaconsHit++;
            audioManager.playBeacon();
            triggerHaptic('heavy');
            createExplosion(targetPxX, targetPxY, '#FFB703', 24);

            if (Math.random() < 0.5) {
              const pwTypes: PowerupType[] = ['freeze', 'supernova', 'shield'];
              triggerPowerup(pwTypes[Math.floor(Math.random() * pwTypes.length)]);
            }
          } else {
            audioManager.playTap(state.multiplier);
            triggerHaptic('light');
            createExplosion(targetPxX, targetPxY, target.color, 16);
          }

          state.floatingTexts.push(
            floatingTextPool.acquire(
              `fl_${Date.now()}`,
              state.multiplier > 1 ? `+${pointsGained} (x${state.multiplier})` : `+${pointsGained}`,
              targetPxX,
              targetPxY,
              state.multiplier >= 5 ? '#00F5D4' : target.color,
              1 + state.multiplier * 0.1
            )
          );

          state.clickLogs.push({
            timestampMs: nowOffset,
            xPct: (touchX / cssWidth) * 100,
            yPct: (touchY / cssHeight) * 100,
            type: 'hit',
            timestamp: nowOffset,
            targetId: target.id,
            targetType: target.type,
            x: touchX,
            y: touchY,
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
        timestampMs: nowOffset,
        xPct: (touchX / cssWidth) * 100,
        yPct: (touchY / cssHeight) * 100,
        type: 'miss',
        timestamp: nowOffset,
        x: touchX,
        y: touchY,
        hit: false,
        scoreGained: 0,
      });
    }

    const activePws: PowerupType[] = [];
    if (state.activePowerups.freeze > performance.now()) activePws.push('freeze');
    if (state.activePowerups.shield > 0) activePws.push('shield');

    onScoreUpdate(state.score, state.combo, state.multiplier, activePws);
  }, [isPlaying, isPaused, createExplosion, triggerPowerup, onScoreUpdate, reduceMotion]);

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

  // Pause when application loses visibility (e.g. app minimized or tab switched)
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

  // Main 60 FPS Render Loop with devicePixelRatio & Adaptive Quality Monitoring
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
        return; // Throttle to 60 FPS on 120Hz/ProMotion displays
      }
      lastFrameTimestamp = currentTime;

      const state = gameStateRef.current;
      const deltaTime = Math.min(deltaMs / 1000, 0.1);
      state.lastFrameTime = currentTime;

      // Register Frame Delta in Adaptive Performance Controller
      performanceManager.registerFrame(deltaMs);
      const perfConfig = performanceManager.getConfig();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Scale context to devicePixelRatio for razor-sharp rendering on Retina displays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isFrozen = state.activePowerups.freeze > currentTime;

      if (isPlaying && !isPaused) {
        const elapsed = (currentTime - state.roundStartTime) / 1000;
        state.timeLeft = Math.max(0, state.roundDuration - elapsed);
        onTimeUpdate(Math.ceil(state.timeLeft));

        state.targetSpawnTimer += deltaTime;
        const spawnInterval = isFrozen ? 1.5 : Math.max(0.4, 1.2 - elapsed * 0.015);

        if (state.targetSpawnTimer >= spawnInterval && state.targets.length < perfConfig.maxTargetsOnScreen) {
          spawnTarget(width, height);
          state.targetSpawnTimer = 0;
        }

        if (state.timeLeft <= 0) {
          const accuracy = state.totalTaps > 0 ? Math.round((state.hits / state.totalTaps) * 100) : 0;
          const finalStats: RoundStats = {
            roundId: `rnd_${Date.now()}`,
            score: state.score,
            rawScore: state.score,
            totalTaps: state.totalTaps,
            hits: state.hits,
            misses: state.misses,
            maxCombo: state.maxCombo,
            accuracy,
            minesHit: state.minesHit,
            goldenBeaconsHit: state.goldenBeaconsHit,
            powerupsUsed: state.powerupsUsed,
            duration: 45,
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

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (backdropId === 'orion_nebula') {
        bgGrad.addColorStop(0, '#02050e');
        bgGrad.addColorStop(1, '#00F5D4');
      } else if (backdropId === 'saturn_rings') {
        bgGrad.addColorStop(0, '#100018');
        bgGrad.addColorStop(1, '#FB5607');
      } else {
        bgGrad.addColorStop(0, '#0b071e');
        bgGrad.addColorStop(1, '#FF007F');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Starfield (Adapted Density)
      ctx.fillStyle = '#FFFFFF';
      const starCount = perfConfig.enableGlowBlur ? 50 : 30;
      for (let i = 0; i < starCount; i++) {
        const starX = (Math.sin(i * 99) * 0.5 + 0.5) * width;
        const starY = ((Math.cos(i * 33) * 0.5 + 0.5) * height + currentTime * (0.02 + (i % 3) * 0.02)) % height;
        ctx.fillRect(starX, starY, 2, 2);
      }

      // Synth Horizon Grid
      state.gridOffset = (state.gridOffset + deltaTime * (state.multiplier >= 5 ? 120 : 60)) % perfConfig.gridStep;
      const horizonY = height * 0.65;

      ctx.strokeStyle = state.multiplier >= 5 ? '#00F5D4' : '#9D4EDD';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.35;

      for (let y = horizonY; y < height; y += perfConfig.gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const gridLines = Math.floor(width / (perfConfig.gridStep * 1.5));
      for (let i = -gridLines; i <= gridLines * 2; i++) {
        const startX = i * perfConfig.gridStep * 1.5 + state.gridOffset;
        ctx.beginPath();
        ctx.moveTo(startX, horizonY);
        ctx.lineTo((startX - width / 2) * 2.8 + width / 2, height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Render Active Targets
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const target = state.targets[i];
        const targetPxX = (target.x / 100) * width;
        const targetPxY = (target.y / 100) * height;

        const age = currentTime - target.spawnTime;
        const growProgress = Math.min(1, age / 250);
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
        } else {
          ctx.fillStyle = target.color;
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

        if (currentTime - target.spawnTime > target.lifespan) {
          state.targets.splice(i, 1);
        }
      }

      // Render & Recycle Particles via Object Pool
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

      // Render & Recycle Floating Score Text
      for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
        const ft = state.floatingTexts[i];
        ft.y -= 40 * deltaTime;
        ft.life += deltaTime;
        ft.alpha = Math.max(0, 1 - ft.life / 1.2);

        ctx.fillStyle = ft.color;
        ctx.globalAlpha = ft.alpha;
        ctx.font = 'bold 15px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);

        if (ft.life >= 1.2) {
          const deadFt = state.floatingTexts.splice(i, 1)[0];
          floatingTextPool.release(deadFt);
        }
      }
      ctx.globalAlpha = 1.0;

      // Render Ship
      const shipX = width / 2;
      const shipY = height * 0.82;

      ctx.save();
      ctx.translate(shipX, shipY);

      if (perfConfig.enableGlowBlur) {
        ctx.shadowColor = shipColor;
        ctx.shadowBlur = state.multiplier >= 5 ? 20 : 10;
      }

      ctx.fillStyle = shipColor;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(16, 18);
      ctx.lineTo(0, 10);
      ctx.lineTo(-16, 18);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, isPaused, backdropId, shipColor, trailType, dailySeed, onRoundComplete, onTimeUpdate, spawnTarget, reduceMotion]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onMouseDown={handleMouseDown}
        className="block w-full h-full cursor-crosshair touch-none"
      />
      {crtIntensity !== 'off' && (
        <div
          className={`absolute inset-0 pointer-events-none crt-overlay ${
            crtIntensity === 'high' ? 'crt-flicker' : ''
          }`}
        />
      )}
    </div>
  );
};
