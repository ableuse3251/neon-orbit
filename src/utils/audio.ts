/**
 * Web Audio API Synth Engine for retro chip sound effects and 4 original synthwave loops.
 */

import { TargetType } from '../types/game';
import { soundscapeManager, MenuScene, NavSoundAction } from './soundscape';

export { soundscapeManager };
export type { MenuScene, NavSoundAction };

export interface SynthwaveTrackInfo {
  id: number;
  title: string;
  artist: string;
  source: string;
  url: string;
  bpm: number;
  genre: string;
}

export const SYNTHWAVE_TRACKS: SynthwaveTrackInfo[] = [
  {
    id: 0,
    title: 'Galaxy',
    artist: 'Synthwave Studio',
    source: 'Cosmic Synthwave',
    url: '/assets/aistudio/galaxy_0296b41f.mp3',
    bpm: 120,
    genre: 'Outrun Synthwave',
  },
  {
    id: 1,
    title: 'Surge Hope',
    artist: 'SVRGE',
    source: 'Cyber Drive',
    url: '/assets/aistudio/svrge-hope_1bd443e1.mp3',
    bpm: 128,
    genre: 'Darksynth Cyber',
  },
  {
    id: 2,
    title: 'Road to Home',
    artist: 'Retrowave Audio',
    source: 'Outrun Retrowave',
    url: '/assets/aistudio/road-to-home_a16e017d.mp3',
    bpm: 110,
    genre: '80s Retrowave',
  },
  {
    id: 3,
    title: 'Arcade Time',
    artist: 'Arcade Synth',
    source: 'Retro Arcade',
    url: '/assets/aistudio/arcade-time_26f2834c.mp3',
    bpm: 124,
    genre: 'Arcade Synthpop',
  },
];

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
  private currentTrackIndex: number = 0;
  private htmlAudio: HTMLAudioElement | null = null;

  constructor() {
    soundscapeManager.setMusicCallback((trackIndex) => {
      this.startSynthwaveLoop(trackIndex ?? 0);
    });
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
    if (this.htmlAudio) {
      this.htmlAudio.volume = Math.max(0, Math.min(1, this.volumeMusic * 0.7));
    }
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

  // Target tap click sound effect
  public playTargetSound(_type: TargetType, combo: number = 1) {
    this.playTap(combo);
  }

  private playComet() {
    this.playTap(2);
  }

  private playMagnet() {
    this.playTap(1);
  }

  private playBlackHole() {
    this.playTap(1);
  }

  private playBossHit() {
    this.playTap(3);
  }

  public playBeacon() {
    this.playTap(2);
  }

  public playMine() {
    this.playTap(1);
  }

  public playSupernova() {
    this.playTap(3);
  }

  public playFreeze() {
    this.playTap(1);
  }

  public playShield() {
    this.playTap(2);
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

  public getTracks(): SynthwaveTrackInfo[] {
    return SYNTHWAVE_TRACKS;
  }

  public getCurrentTrack(): SynthwaveTrackInfo {
    return SYNTHWAVE_TRACKS[this.currentTrackIndex] || SYNTHWAVE_TRACKS[0];
  }

  public selectTrack(trackIndex: number) {
    const validIndex = Math.max(0, Math.min(trackIndex, SYNTHWAVE_TRACKS.length - 1));
    this.currentTrackIndex = validIndex;
    this.currentLoopIndex = validIndex;

    if (this.isMusicPlaying) {
      this.stopMusic();
      this.startSynthwaveLoop(validIndex);
    }
  }

  public startSynthwaveLoop(loopIndex: number = 0) {
    if (!this.musicEnabled) return;

    soundscapeManager.stopMenuAmbient();

    const validIndex = Math.max(0, Math.min(loopIndex, SYNTHWAVE_TRACKS.length - 1));
    this.currentTrackIndex = validIndex;
    this.currentLoopIndex = validIndex;
    this.isMusicPlaying = true;

    // 1. Attempt streaming royalty-free Pixabay / BreakingCopyright track via HTML5 Audio
    const track = SYNTHWAVE_TRACKS[validIndex];
    if (typeof window !== 'undefined' && track?.url) {
      try {
        if (!this.htmlAudio) {
          this.htmlAudio = new Audio();
          this.htmlAudio.loop = true;
        }
        this.htmlAudio.src = track.url;
        this.htmlAudio.volume = Math.max(0, Math.min(1, this.volumeMusic * 0.7));
        const playPromise = this.htmlAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Fallback to Web Audio synthesizer loop if audio playback is blocked or fails
            this.playSynthesizedWebAudioLoop();
          });
        }
      } catch {
        this.playSynthesizedWebAudioLoop();
      }
    } else {
      this.playSynthesizedWebAudioLoop();
    }
  }

  private playSynthesizedWebAudioLoop() {
    this.initCtx();
    if (!this.ctx) return;

    const synthNotes = this.synthLoops[this.currentLoopIndex] || this.synthLoops[0];
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
    const next = Math.max(0, Math.min(loopIndex, SYNTHWAVE_TRACKS.length - 1));
    if (next !== this.currentTrackIndex && this.isMusicPlaying) {
      this.selectTrack(next);
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;

    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.currentTime = 0;
      } catch {}
    }

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

  public playNavClick() {
    soundscapeManager.playNavAction(1.0);
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
