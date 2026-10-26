/**
 * Synthwave Audio Engine strictly playing royalty-free MP3 music tracks:
 * 1. Galaxy (/assets/aistudio/galaxy_0296b41f.mp3)
 * 2. Surge Hope (/assets/aistudio/svrge-hope_1bd443e1.mp3)
 * 3. Road to Home (/assets/aistudio/road-to-home_a16e017d.mp3)
 * 4. Arcade Time (/assets/aistudio/arcade-time_26f2834c.mp3)
 *
 * Sound effects are strictly short retro tap/click tones.
 * Zero procedural synthesizer music loops!
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
    source: 'Pixabay Synthwave',
    url: '/assets/aistudio/galaxy_0296b41f.mp3',
    bpm: 120,
    genre: 'Outrun Synthwave',
  },
  {
    id: 1,
    title: 'Surge Hope',
    artist: 'SVRGE',
    source: 'BreakingCopyright',
    url: '/assets/aistudio/svrge-hope_1bd443e1.mp3',
    bpm: 128,
    genre: 'Darksynth Cyber',
  },
  {
    id: 2,
    title: 'Road to Home',
    artist: 'Retrowave Audio',
    source: 'Pixabay Synthwave',
    url: '/assets/aistudio/road-to-home_a16e017d.mp3',
    bpm: 110,
    genre: '80s Retrowave',
  },
  {
    id: 3,
    title: 'Arcade Time',
    artist: 'Arcade Synth',
    source: 'BreakingCopyright',
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
  private currentTrackIndex: number = 0;
  private htmlAudio: HTMLAudioElement | null = null;

  constructor() {
    soundscapeManager.setMusicCallback((trackIndex) => {
      this.startSynthwaveLoop(trackIndex ?? this.currentTrackIndex);
    });

    if (typeof window !== 'undefined') {
      const handleUserGesture = () => {
        this.unlockAudio();
      };
      window.addEventListener('pointerdown', handleUserGesture);
      window.addEventListener('click', handleUserGesture);
      window.addEventListener('touchstart', handleUserGesture);
      window.addEventListener('keydown', handleUserGesture);
    }
  }

  public unlockAudio() {
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.musicEnabled && this.isMusicPlaying) {
      this.playHtmlAudioTrack(this.currentTrackIndex);
    }
  }

  private playHtmlAudioTrack(trackIndex: number) {
    if (typeof window === 'undefined') return;

    const validIndex = Math.max(0, Math.min(trackIndex, SYNTHWAVE_TRACKS.length - 1));
    const track = SYNTHWAVE_TRACKS[validIndex];
    if (!track) return;

    if (!this.htmlAudio) {
      this.htmlAudio = new Audio();
      this.htmlAudio.loop = true;
    }

    if (!this.htmlAudio.src || !this.htmlAudio.src.endsWith(track.url)) {
      this.htmlAudio.src = track.url;
    }

    this.htmlAudio.volume = Math.max(0, Math.min(1, this.volumeMusic * 0.7));

    const playPromise = this.htmlAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Synthwave HTML5 track waiting for user gesture:', err?.message || err);
      });
    }
  }

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
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
    } else if (this.musicEnabled && !this.isMusicPlaying) {
      this.startSynthwaveLoop(this.currentTrackIndex);
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
    } else if (enabled && !this.isMusicPlaying) {
      this.startSynthwaveLoop(this.currentTrackIndex);
    }
  }

  public playTap(comboMultiplier: number = 1) {
    if (!this.soundEnabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      const baseFreq = 350 + Math.min(comboMultiplier, 10) * 110;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, this.ctx.currentTime + 0.05);

      const gainVal = Math.min(0.2, 0.12 * this.volumeFx);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Ignored
    }
  }

  public playTargetSound(_type: TargetType, combo: number = 1) {
    this.playTap(combo);
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

  public playCountdownBeep(_isGo: boolean = false) {
    this.playTap(2);
  }

  public playHyperMode() {
    this.playTap(3);
  }

  public getTracks(): SynthwaveTrackInfo[] {
    return SYNTHWAVE_TRACKS;
  }

  public getCurrentTrack(): SynthwaveTrackInfo {
    return SYNTHWAVE_TRACKS[this.currentTrackIndex] || SYNTHWAVE_TRACKS[0];
  }

  public selectTrack(trackIndex: number) {
    const validIndex = Math.max(0, Math.min(trackIndex, SYNTHWAVE_TRACKS.length - 1));
    this.currentTrackIndex = validIndex;
    this.stopMusic();
    if (this.musicEnabled) {
      this.startSynthwaveLoop(validIndex);
    }
  }

  public startSynthwaveLoop(loopIndex?: number) {
    if (!this.musicEnabled) return;

    const validIndex = loopIndex !== undefined
      ? Math.max(0, Math.min(loopIndex, SYNTHWAVE_TRACKS.length - 1))
      : this.currentTrackIndex;

    if (this.isMusicPlaying && this.currentTrackIndex === validIndex && this.htmlAudio && !this.htmlAudio.paused) {
      this.htmlAudio.volume = Math.max(0, Math.min(1, this.volumeMusic * 0.7));
      return;
    }

    this.currentTrackIndex = validIndex;
    this.isMusicPlaying = true;

    this.playHtmlAudioTrack(validIndex);
  }

  public switchLoop(loopIndex: number) {
    const next = Math.max(0, Math.min(loopIndex, SYNTHWAVE_TRACKS.length - 1));
    if (next !== this.currentTrackIndex) {
      this.selectTrack(next);
    }
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
      } catch {}
    }
  }

  public startMenuAmbient(_scene: MenuScene = 'orbit') {
    if (!this.musicEnabled) return;
    if (!this.isMusicPlaying) {
      this.startSynthwaveLoop(this.currentTrackIndex);
    }
  }

  public stopMenuAmbient() {
    this.stopMusic();
  }

  public setMenuScene(scene: MenuScene | string) {
    soundscapeManager.setMenuScene(scene);
  }

  public playNavTab(_tabId?: string) {
    this.playTap(1);
  }

  public playModalOpen(_modalName?: string) {
    this.playTap(1);
  }

  public playModalClose() {
    this.playTap(1);
  }

  public playNavAction(_pitchMultiplier?: number) {
    this.playTap(1);
  }

  public playNavClick() {
    this.playTap(1);
  }

  public playNavConfirm() {
    this.playTap(2);
  }

  public playNavReject() {
    this.playTap(1);
  }

  public playNavHover() {
    // Subtle hover tap if needed
  }

  public playNavSound(_action: NavSoundAction, _context?: string) {
    this.playTap(1);
  }
}

export const audioManager = new SoundEngine();
