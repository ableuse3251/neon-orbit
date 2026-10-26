/**
 * Procedurally Generated Synthwave Ambient Soundscape & Navigation Audio Engine
 *
 * Provides dynamic, evolving analog synth ambient soundscapes during menu navigation
 * and replaces flat/sterile clicking sounds with harmonic, reactive synthwave sound gestures.
 */

export type MenuScene =
  | 'orbit'
  | 'play'
  | 'hangar'
  | 'shop'
  | 'starsShop'
  | 'leaderboard'
  | 'missions'
  | 'achievements'
  | 'streak'
  | 'referrals'
  | 'settings'
  | 'seasonPass'
  | 'dailyContent'
  | 'viral'
  | 'admin'
  | 'adminDashboard'
  | 'profile'
  | 'registration'
  | (string & {});

export type NavSoundAction =
  | 'tab'
  | 'modal_open'
  | 'modal_close'
  | 'action'
  | 'confirm'
  | 'reject'
  | 'hover';

interface SceneHarmony {
  rootFreq: number; // Fundamental drone frequency in Hz
  subFreq: number;  // Sub-bass frequency
  padFreqs: number[]; // Frequencies for detuned pad chords
  scaleNotes: number[]; // Notes for procedural ambient bell/arpeggio drops
  filterCutoff: number; // Base cutoff frequency for low-pass filter
  resonance: number;
}

// Retro synthwave modal palettes per menu scene
const SCENE_HARMONIES: Record<string, SceneHarmony> = {
  orbit: {
    rootFreq: 110.0, // A2 (A minor)
    subFreq: 55.0,   // A1
    padFreqs: [110.0, 164.81, 220.0, 329.63], // A2, E3, A3, E4
    scaleNotes: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 659.25], // Am pentatonic/aeolian
    filterCutoff: 420,
    resonance: 3.5,
  },
  play: {
    rootFreq: 110.0,
    subFreq: 55.0,
    padFreqs: [110.0, 164.81, 220.0, 329.63],
    scaleNotes: [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 659.25],
    filterCutoff: 450,
    resonance: 3.5,
  },
  hangar: {
    rootFreq: 87.31, // F2 (F minor / Cyber Dorian)
    subFreq: 43.65,  // F1
    padFreqs: [87.31, 130.81, 174.61, 261.63], // F2, C3, F3, C4
    scaleNotes: [174.61, 207.65, 261.63, 311.13, 349.23, 415.3, 523.25],
    filterCutoff: 520,
    resonance: 4.0,
  },
  shop: {
    rootFreq: 87.31,
    subFreq: 43.65,
    padFreqs: [87.31, 130.81, 174.61, 261.63],
    scaleNotes: [174.61, 207.65, 261.63, 311.13, 349.23, 415.3, 523.25],
    filterCutoff: 520,
    resonance: 4.0,
  },
  leaderboard: {
    rootFreq: 73.42, // D2 (D minor / Arcade Phrygian)
    subFreq: 36.71,  // D1
    padFreqs: [73.42, 110.0, 146.83, 220.0], // D2, A2, D3, A3
    scaleNotes: [146.83, 174.61, 220.0, 261.63, 293.66, 349.23, 440.0],
    filterCutoff: 380,
    resonance: 4.5,
  },
  missions: {
    rootFreq: 82.41, // E2 (E minor / Deep Space Aeolian)
    subFreq: 41.2,   // E1
    padFreqs: [82.41, 123.47, 164.81, 246.94], // E2, B2, E3, B3
    scaleNotes: [164.81, 196.0, 246.94, 293.66, 329.63, 392.0, 493.88],
    filterCutoff: 460,
    resonance: 3.8,
  },
  streak: {
    rootFreq: 98.0, // G2 (G major / Celestial Lydian)
    subFreq: 49.0,  // G1
    padFreqs: [98.0, 146.83, 196.0, 293.66], // G2, D3, G3, D4
    scaleNotes: [196.0, 246.94, 293.66, 369.99, 392.0, 493.88, 587.33],
    filterCutoff: 580,
    resonance: 3.2,
  },
  referrals: {
    rootFreq: 65.41, // C2 (C major / Retro Arcade Squad)
    subFreq: 32.7,   // C1
    padFreqs: [65.41, 98.0, 130.81, 196.0], // C2, G2, C3, G3
    scaleNotes: [130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25],
    filterCutoff: 480,
    resonance: 3.0,
  },
  settings: {
    rootFreq: 55.0,  // A1 (Cyber Terminal Low Frequency Ambient)
    subFreq: 27.5,   // Sub rumble
    padFreqs: [55.0, 110.0, 165.0, 220.0],
    scaleNotes: [110.0, 165.0, 220.0, 330.0, 440.0],
    filterCutoff: 300,
    resonance: 2.5,
  },
  seasonPass: {
    rootFreq: 98.0,
    subFreq: 49.0,
    padFreqs: [98.0, 146.83, 196.0, 293.66],
    scaleNotes: [196.0, 246.94, 293.66, 369.99, 392.0, 493.88, 587.33],
    filterCutoff: 540,
    resonance: 3.6,
  },
  admin: {
    rootFreq: 73.42,
    subFreq: 36.71,
    padFreqs: [73.42, 110.0, 146.83, 220.0],
    scaleNotes: [146.83, 174.61, 220.0, 261.63, 293.66, 349.23, 440.0],
    filterCutoff: 400,
    resonance: 4.0,
  },
};

// Aliases for matching modal and navigation state routes
SCENE_HARMONIES.achievements = SCENE_HARMONIES.missions;
SCENE_HARMONIES.dailyContent = SCENE_HARMONIES.missions;
SCENE_HARMONIES.starsShop = SCENE_HARMONIES.shop;
SCENE_HARMONIES.viral = SCENE_HARMONIES.referrals;
SCENE_HARMONIES.adminDashboard = SCENE_HARMONIES.admin;
SCENE_HARMONIES.profile = SCENE_HARMONIES.orbit;
SCENE_HARMONIES.registration = SCENE_HARMONIES.orbit;

export class MenuSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private volumeFx: number = 0.8;
  private volumeMusic: number = 0.6;

  // Ambient soundscape audio graph nodes
  private isAmbientPlaying: boolean = false;
  private currentScene: MenuScene = 'orbit';
  private masterAmbientGain: GainNode | null = null;
  private mainFilter: BiquadFilterNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  // Generative shimmer loop
  private shimmerTimer: number | null = null;
  private shimmerIndex: number = 0;

  constructor() {
    // Lazily initialized on first interaction
  }

  /**
   * Initializes or resumes the AudioContext with browser autoplay policy handling.
   */
  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setVolumes(fx: number, music: number) {
    this.volumeFx = Math.max(0, Math.min(1, fx));
    this.volumeMusic = Math.max(0, Math.min(1, music));
    this.soundEnabled = this.volumeFx > 0;
    this.musicEnabled = this.volumeMusic > 0;

    if (this.masterAmbientGain && this.ctx) {
      const targetGain = this.musicEnabled ? this.volumeMusic * 0.12 : 0;
      this.masterAmbientGain.gain.linearRampToValueAtTime(
        targetGain,
        this.ctx.currentTime + 0.3
      );
    }

    if (!this.musicEnabled && this.isAmbientPlaying) {
      this.stopMenuAmbient();
    }
  }

  public setSoundFx(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled && this.isAmbientPlaying) {
      this.stopMenuAmbient();
    } else if (enabled && !this.isAmbientPlaying) {
      this.startMenuAmbient(this.currentScene);
    }
  }

  private onStartMusic?: (trackIndex?: number) => void;

  public setMusicCallback(cb: (trackIndex?: number) => void) {
    this.onStartMusic = cb;
  }

  /**
   * Starts background music playback using royalty-free Pixabay / BreakingCopyright tracks.
   * Procedural background drones and ambient noise oscillators have been disabled.
   */
  public startMenuAmbient(scene: MenuScene = 'orbit') {
    if (!this.musicEnabled) return;
    this.currentScene = scene;
    this.isAmbientPlaying = true;
    if (this.onStartMusic) {
      this.onStartMusic(0);
    }
  }

  public setMenuScene(scene: MenuScene | string) {
    this.currentScene = scene as MenuScene;
  }

  private startGenerativeShimmer() {
    // Disabled: Procedural generative ambient drops removed
  }

  private playAtmosphericDrop(_freq: number) {
    // Disabled: Procedural generative ambient drops removed
  }

  /**
   * Stops the ambient soundscape with an elegant exponential fade out.
   */
  public stopMenuAmbient() {
    this.isAmbientPlaying = false;

    if (this.shimmerTimer !== null) {
      clearTimeout(this.shimmerTimer);
      this.shimmerTimer = null;
    }

    if (this.masterAmbientGain && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.masterAmbientGain.gain.cancelScheduledValues(now);
        this.masterAmbientGain.gain.setValueAtTime(this.masterAmbientGain.gain.value, now);
        this.masterAmbientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      } catch {
        // Fallback
      }
    }

    setTimeout(() => {
      try {
        this.droneOscA?.stop();
        this.droneOscB?.stop();
        this.subOsc?.stop();
        this.lfoOsc?.stop();

        this.droneOscA?.disconnect();
        this.droneOscB?.disconnect();
        this.subOsc?.disconnect();
        this.lfoOsc?.disconnect();
        this.lfoGain?.disconnect();
        this.mainFilter?.disconnect();
        this.delayNode?.disconnect();
        this.delayFeedback?.disconnect();
        this.masterAmbientGain?.disconnect();

        this.droneOscA = null;
        this.droneOscB = null;
        this.subOsc = null;
        this.lfoOsc = null;
        this.lfoGain = null;
        this.mainFilter = null;
        this.delayNode = null;
        this.delayFeedback = null;
        this.masterAmbientGain = null;
      } catch {
        // Ignored
      }
    }, 650);
  }

  // =========================================================================
  // DYNAMIC PROCEDURAL SYNTHWAVE NAVIGATION SOUNDS (Replaces simple clicks)
  // =========================================================================

  /**
   * Plays a harmonic synthwave gesture whenever switching tabs in BottomNav or TopNav.
   */
  public playNavTab(tabId?: string) {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const harmony = SCENE_HARMONIES[tabId || 'orbit'] || SCENE_HARMONIES.orbit;
    const baseFreq = harmony.padFreqs[1] || 220.0;
    const now = ctx.currentTime;

    try {
      // Carrier oscillator (Saw/Triangle FM feel)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      // Gentle pitch glide up (synth micro-bend)
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.33, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(baseFreq * 3.2, now);
      filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.16);
      filter.Q.setValueAtTime(3.5, now);

      const amp = Math.min(0.25, 0.16 * this.volumeFx);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignored
    }
  }

  /**
   * Plays an opening resonant swell chord when a modal (Hangar, Rankings, Streak) appears.
   */
  public playModalOpen(modalName?: string) {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const harmony = SCENE_HARMONIES[modalName || 'shop'] || SCENE_HARMONIES.orbit;
    const now = ctx.currentTime;
    const chordNotes = [harmony.padFreqs[0] * 2, harmony.padFreqs[1] * 2];

    chordNotes.forEach((freq, idx) => {
      try {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.03);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now + idx * 0.03);
        filter.frequency.exponentialRampToValueAtTime(1800, now + idx * 0.03 + 0.14);

        const amp = Math.min(0.2, 0.13 * this.volumeFx);
        gain.gain.setValueAtTime(0.001, now + idx * 0.03);
        gain.gain.linearRampToValueAtTime(amp, now + idx * 0.03 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.03 + 0.28);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.28);
      } catch {
        // Ignored
      }
    });
  }

  /**
   * Plays a soft descending filter sweep when closing a modal.
   */
  public playModalClose() {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.15);

      const amp = Math.min(0.2, 0.14 * this.volumeFx);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Ignored
    }
  }

  /**
   * Tactile analog synth-pluck for button presses, replacing standard click noises.
   */
  public playNavAction(pitchMultiplier: number = 1.0) {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const harmony = SCENE_HARMONIES[this.currentScene] || SCENE_HARMONIES.orbit;
    const baseFreq = (harmony.padFreqs[0] || 110.0) * 2.5 * pitchMultiplier;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);

      // Fast analog filter snap (Juno-60 snap envelope)
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(baseFreq * 5, now);
      filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.09);
      filter.Q.setValueAtTime(2.8, now);

      const amp = Math.min(0.22, 0.15 * this.volumeFx);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignored
    }
  }

  /**
   * Celebratory ascending synth arpeggio for claiming rewards or equipping skins.
   */
  public playNavConfirm() {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [330.0, 440.0, 659.25, 880.0]; // E4, A4, E5, A5
    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      try {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        const amp = Math.min(0.25, 0.16 * this.volumeFx);
        gain.gain.setValueAtTime(amp, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.18);
      } catch {
        // Ignored
      }
    });
  }

  /**
   * Soft rejection buzz for insufficient stardust or locked items.
   */
  public playNavReject() {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.setValueAtTime(95, now + 0.07);

      const amp = Math.min(0.2, 0.14 * this.volumeFx);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignored
    }
  }

  /**
   * Ultra-soft tactile micro-blip on hover/focus.
   */
  public playNavHover() {
    if (!this.soundEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);

      const amp = Math.min(0.06, 0.04 * this.volumeFx);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignored
    }
  }

  /**
   * Unified dispatcher for any navigation sound.
   */
  public playNavSound(action: NavSoundAction, context?: string) {
    switch (action) {
      case 'tab':
        this.playNavTab(context);
        break;
      case 'modal_open':
        this.playModalOpen(context);
        break;
      case 'modal_close':
        this.playModalClose();
        break;
      case 'confirm':
        this.playNavConfirm();
        break;
      case 'reject':
        this.playNavReject();
        break;
      case 'hover':
        this.playNavHover();
        break;
      case 'action':
      default:
        this.playNavAction();
        break;
    }
  }
}

export const soundscapeManager = new MenuSoundscapeEngine();
