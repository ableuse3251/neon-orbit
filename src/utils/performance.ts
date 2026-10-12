export type QualityTier = 'high' | 'medium' | 'low';

export interface PerformanceConfig {
  particleMultiplier: number;
  maxActiveParticles: number;
  enableGlowBlur: boolean;
  glowBlurRadius: number;
  gridStep: number;
  maxTargetsOnScreen: number;
}

class PerformanceManager {
  private frameTimes: number[] = [];
  private currentTier: QualityTier = 'high';
  private manualOverride: 'low' | 'auto' | 'high' = 'auto';

  public setManualOverride(mode: 'low' | 'auto' | 'high') {
    this.manualOverride = mode;
  }

  public registerFrame(frameDeltaMs: number): QualityTier {
    if (this.manualOverride === 'low') {
      this.currentTier = 'low';
      return 'low';
    }
    if (this.manualOverride === 'high') {
      this.currentTier = 'high';
      return 'high';
    }

    // Measure rolling average FPS over 45 frames
    this.frameTimes.push(frameDeltaMs);
    if (this.frameTimes.length > 45) {
      this.frameTimes.shift();
    }

    const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / (avgDelta || 16.6);

    // Adaptive hysteresis threshold switching
    if (fps < 38) {
      this.currentTier = 'low';
    } else if (fps < 52 && this.currentTier === 'high') {
      this.currentTier = 'medium';
    } else if (fps > 56 && this.currentTier === 'low') {
      this.currentTier = 'medium';
    } else if (fps > 58) {
      this.currentTier = 'high';
    }

    return this.currentTier;
  }

  public getConfig(): PerformanceConfig {
    switch (this.currentTier) {
      case 'low':
        return {
          particleMultiplier: 0.3,
          maxActiveParticles: 60,
          enableGlowBlur: false, // Disabling canvas shadowBlur yields huge GPU gain on Android!
          glowBlurRadius: 0,
          gridStep: 28,
          maxTargetsOnScreen: 5,
        };
      case 'medium':
        return {
          particleMultiplier: 0.6,
          maxActiveParticles: 120,
          enableGlowBlur: true,
          glowBlurRadius: 6,
          gridStep: 22,
          maxTargetsOnScreen: 7,
        };
      case 'high':
      default:
        return {
          particleMultiplier: 1.0,
          maxActiveParticles: 250,
          enableGlowBlur: true,
          glowBlurRadius: 15,
          gridStep: 18,
          maxTargetsOnScreen: 9,
        };
    }
  }

  public getTier(): QualityTier {
    return this.currentTier;
  }
}

export const performanceManager = new PerformanceManager();
