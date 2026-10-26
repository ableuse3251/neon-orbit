/**
 * Web Audio API Synth Engine for retro chip sound effects and 4 original synthwave loops.
 */

import { TargetType } from '../types/game';
import { soundscapeManager, MenuScene, NavSoundAction } from './soundscape';

export { soundscapeManager };
export type { MenuScene, NavSoundAction };

class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private volumeFx: number = 0.8;
  private volumeMusic: number = 0.6;
  private isMusicPlaying: boolean = false;
  private musicTimer: number | null = null;
  private noteIndex: number = 0;
  private currentLoopIndex: number = 0;

  constructor() {
    // Lazily initialize AudioContext on user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(fx: number, music: number) {
    this.volumeFx = Math.max(0, Math.min(1, fx));
    this.volumeMusic = Math.max(0, Math.min(1, music));
    this.soundEnabled = this.volumeFx > 0;
    this.musicEnabled = this.volumeMusic > 0;
    soundscapeManager.setVolumes(this.volumeFx, this.volumeMusic);
    if (!this.musicEnabled && this.isMusicPlaying) {
      this.stopMusic();
    }
  }

  public setSoundFx(enabled: boolean) {
    this.soundEnabled = enabled;
    soundscapeManager.setSoundFx(enabled);
  }

  public setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    soundscapeManager.setMusic(enabled);
    if (!enabled && this.isMusicPlaying) {
      this.stopMusic();
    }
  }

  // Play retro tap chime (pitch varies with combo level)
  public playTap(comboMultiplier: number = 1) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    const baseFreq = 350 + Math.min(comboMultiplier, 10) * 110;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, this.ctx.currentTime + 0.08);

    const gainVal = Math.min(0.25, 0.15 * this.volumeFx);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // Target-specific chiptune sound effects
  public playTargetSound(type: TargetType, combo: number = 1) {
    switch (type) {
      case 'golden_beacon':
      case 'double_beacon':
        this.playBeacon();
        break;
      case 'comet':
        this.playComet();
        break;
      case 'mine':
        this.playMine();
        break;
      case 'magnet':
        this.playMagnet();
        break;
      case 'black_hole':
        this.playBlackHole();
        break;
      case 'boss_meteor':
        this.playBossHit();
        break;
      case 'asteroid':
      default:
        this.playTap(combo);
        break;
    }
  }

  private playComet() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 0.15);

    const g = Math.min(0.2, 0.15 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  private playMagnet() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.12);

    const g = Math.min(0.2, 0.15 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  private playBlackHole() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);

    const g = Math.min(0.3, 0.2 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  private playBossHit() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(250, this.ctx.currentTime);
    osc.frequency.setValueAtTime(450, this.ctx.currentTime + 0.05);

    const g = Math.min(0.25, 0.18 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // Play Golden Beacon extra points chime
  public playBeacon() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.04);

      const g = Math.min(0.25, 0.18 * this.volumeFx);
      gain.gain.setValueAtTime(g, this.ctx.currentTime + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.04);
      osc.stop(this.ctx.currentTime + idx * 0.04 + 0.12);
    });
  }

  // Play Mine explosion noise
  public playMine() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.3);

    const g = Math.min(0.35, 0.25 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  // Play Supernova wipeout sound
  public playSupernova() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.35);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.6);

    const g = Math.min(0.3, 0.2 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }

  // Play Time Freeze chime
  public playFreeze() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.4);

    const g = Math.min(0.25, 0.18 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  // Play Shield activate sound
  public playShield() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.25);

    const g = Math.min(0.25, 0.18 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  public playCountdownBeep(isGo: boolean = false) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isGo ? 'triangle' : 'square';
    const freq = isGo ? 880 : 440;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const g = Math.min(0.2, 0.15 * this.volumeFx);
    gain.gain.setValueAtTime(g, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isGo ? 0.3 : 0.15));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + (isGo ? 0.3 : 0.15));
  }

  public playHyperMode() {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    const freqs = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    freqs.forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime + i * 0.05);

      const g = Math.min(0.2, 0.15 * this.volumeFx);
      gain.gain.setValueAtTime(g, this.ctx.currentTime + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.05 + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + i * 0.05);
      osc.stop(this.ctx.currentTime + i * 0.05 + 0.15);
    });
  }

  // 4 Original Synthwave Loops
  private synthLoops = [
    [110, 130.81, 146.83, 164.81, 110, 130.81, 196.00, 164.81], // Loop 0: Neon Highway (A minor)
    [146.83, 174.61, 220, 261.63, 146.83, 220, 293.66, 261.63], // Loop 1: Cyber Runner (D minor)
    [98.00, 123.47, 146.83, 185.00, 98.00, 146.83, 220, 185.00], // Loop 2: Void Synth (G minor)
    [130.81, 164.81, 196.00, 246.94, 130.81, 196.00, 261.63, 246.94], // Loop 3: Supernova Groove (C major)
  ];

  public startSynthwaveLoop(loopIndex: number = 0) {
    if (!this.musicEnabled || this.isMusicPlaying) return;
    this.initCtx();
    if (!this.ctx) return;

    // Pause ambient menu soundscape while high-energy gameplay music is running
    soundscapeManager.stopMenuAmbient();

    this.currentLoopIndex = Math.max(0, Math.min(loopIndex, this.synthLoops.length - 1));
    this.isMusicPlaying = true;
    const synthNotes = this.synthLoops[this.currentLoopIndex];
    this.noteIndex = 0;

    const playNextNote = () => {
      if (!this.isMusicPlaying || !this.musicEnabled || !this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const freq = synthNotes[this.noteIndex % synthNotes.length];
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const musicGainVal = Math.min(0.08, 0.06 * this.volumeMusic);
      gain.gain.setValueAtTime(musicGainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);

      this.noteIndex++;
      this.musicTimer = window.setTimeout(playNextNote, 180);
    };

    playNextNote();
  }

  public switchLoop(loopIndex: number) {
    const next = Math.max(0, Math.min(loopIndex, this.synthLoops.length - 1));
    if (next !== this.currentLoopIndex && this.isMusicPlaying) {
      this.currentLoopIndex = next;
      this.noteIndex = 0;
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // --- Procedural Synthwave Menu Ambient Soundscapes ---

  public startMenuAmbient(scene: MenuScene = 'orbit') {
    soundscapeManager.startMenuAmbient(scene);
  }

  public stopMenuAmbient() {
    soundscapeManager.stopMenuAmbient();
  }

  public setMenuScene(scene: MenuScene | string) {
    soundscapeManager.setMenuScene(scene);
  }

  // --- Dynamic Procedural Synthwave Navigation Sounds (Replacing simple clicks) ---

  public playNavTab(tabId?: string) {
    soundscapeManager.playNavTab(tabId);
  }

  public playModalOpen(modalName?: string) {
    soundscapeManager.playModalOpen(modalName);
  }

  public playModalClose() {
    soundscapeManager.playModalClose();
  }

  public playNavAction(pitchMultiplier?: number) {
    soundscapeManager.playNavAction(pitchMultiplier);
  }

  public playNavConfirm() {
    soundscapeManager.playNavConfirm();
  }

  public playNavReject() {
    soundscapeManager.playNavReject();
  }

  public playNavHover() {
    soundscapeManager.playNavHover();
  }

  public playNavSound(action: NavSoundAction, context?: string) {
    soundscapeManager.playNavSound(action, context);
  }
}

export const audioManager = new SoundEngine();
