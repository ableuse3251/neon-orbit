import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MenuSoundscapeEngine, soundscapeManager } from '../utils/soundscape';
import { audioManager } from '../utils/audio';

// Mock Web Audio API for Node.js test environment
class MockAudioNode {
  connect = vi.fn().mockReturnValue(this);
  disconnect = vi.fn();
}

class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn().mockReturnThis();
  linearRampToValueAtTime = vi.fn().mockReturnThis();
  exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  cancelScheduledValues = vi.fn().mockReturnThis();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sawtooth';
  frequency = new MockAudioParam();
  detune = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockDelayNode extends MockAudioNode {
  delayTime = new MockAudioParam();
}

class MockAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  currentTime = 10.0;
  destination = new MockAudioNode();
  resume = vi.fn().mockResolvedValue(undefined);
  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createDelay = vi.fn(() => new MockDelayNode());
}

describe('MenuSoundscapeEngine (Procedural Synthwave Ambient Audio)', () => {
  let engine: MenuSoundscapeEngine;

  beforeEach(() => {
    (global as any).window = {
      AudioContext: MockAudioContext,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
    };
    engine = new MenuSoundscapeEngine();
  });

  afterEach(() => {
    engine.stopMenuAmbient();
  });

  it('initializes with expected default volumes and states', () => {
    expect(engine).toBeDefined();
    expect(soundscapeManager).toBeDefined();
  });

  it('updates volumes and clamps values within [0, 1]', () => {
    engine.setVolumes(0.5, 0.7);
    engine.setSoundFx(false);
    engine.setMusic(false);
    // Should not throw and should safely mute
    expect(() => engine.setVolumes(1.5, -0.2)).not.toThrow();
  });

  it('starts and stops ambient soundscape with smooth gain ramping', () => {
    engine.setMusic(true);
    engine.startMenuAmbient('orbit');

    // Morphing through various menu scenes
    const scenes: Array<'orbit' | 'hangar' | 'leaderboard' | 'missions' | 'streak' | 'referrals' | 'settings'> = [
      'hangar',
      'leaderboard',
      'missions',
      'streak',
      'referrals',
      'settings',
      'orbit',
    ];

    scenes.forEach((scene) => {
      expect(() => engine.setMenuScene(scene)).not.toThrow();
    });

    expect(() => engine.stopMenuAmbient()).not.toThrow();
  });

  it('plays procedural navigation soundscapes across all action types', () => {
    engine.setSoundFx(true);

    expect(() => engine.playNavTab('hangar')).not.toThrow();
    expect(() => engine.playNavTab('leaderboard')).not.toThrow();
    expect(() => engine.playModalOpen('shop')).not.toThrow();
    expect(() => engine.playModalClose()).not.toThrow();
    expect(() => engine.playNavAction(1.2)).not.toThrow();
    expect(() => engine.playNavConfirm()).not.toThrow();
    expect(() => engine.playNavReject()).not.toThrow();
    expect(() => engine.playNavHover()).not.toThrow();

    expect(() => engine.playNavSound('tab', 'missions')).not.toThrow();
    expect(() => engine.playNavSound('modal_open', 'streak')).not.toThrow();
    expect(() => engine.playNavSound('modal_close')).not.toThrow();
    expect(() => engine.playNavSound('confirm')).not.toThrow();
    expect(() => engine.playNavSound('reject')).not.toThrow();
    expect(() => engine.playNavSound('hover')).not.toThrow();
    expect(() => engine.playNavSound('action')).not.toThrow();
  });

  it('delegates through audioManager singleton seamlessly', () => {
    audioManager.setVolumes(0.8, 0.6);
    audioManager.setSoundFx(true);
    audioManager.setMusic(true);

    expect(() => audioManager.startMenuAmbient('play')).not.toThrow();
    expect(() => audioManager.setMenuScene('shop')).not.toThrow();
    expect(() => audioManager.playNavTab('orbit')).not.toThrow();
    expect(() => audioManager.playModalOpen('shop')).not.toThrow();
    expect(() => audioManager.playModalClose()).not.toThrow();
    expect(() => audioManager.playNavAction()).not.toThrow();
    expect(() => audioManager.playNavConfirm()).not.toThrow();
    expect(() => audioManager.playNavReject()).not.toThrow();
    expect(() => audioManager.playNavHover()).not.toThrow();
    expect(() => audioManager.playNavSound('tab', 'referrals')).not.toThrow();
    expect(() => audioManager.stopMenuAmbient()).not.toThrow();
  });

  it('operates safely when AudioContext is unavailable (SSR/headless)', () => {
    (global as any).window = {}; // No AudioContext
    const headlessEngine = new MenuSoundscapeEngine();

    expect(() => headlessEngine.startMenuAmbient('orbit')).not.toThrow();
    expect(() => headlessEngine.playNavTab('hangar')).not.toThrow();
    expect(() => headlessEngine.playModalOpen()).not.toThrow();
    expect(() => headlessEngine.playNavAction()).not.toThrow();
    expect(() => headlessEngine.stopMenuAmbient()).not.toThrow();
  });
});
