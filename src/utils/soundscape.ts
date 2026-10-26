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

export class MenuSoundscapeEngine {
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private volumeFx: number = 0.8;
  private volumeMusic: number = 0.6;
  private currentScene: MenuScene = 'orbit';
  private onStartMusic?: (trackIndex?: number) => void;

  public setVolumes(fx: number, music: number) {
    this.volumeFx = Math.max(0, Math.min(1, fx));
    this.volumeMusic = Math.max(0, Math.min(1, music));
    this.soundEnabled = this.volumeFx > 0;
    this.musicEnabled = this.volumeMusic > 0;
  }

  public setSoundFx(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
  }

  public setMusicCallback(cb: (trackIndex?: number) => void) {
    this.onStartMusic = cb;
  }

  public startMenuAmbient(scene: MenuScene = 'orbit') {
    if (!this.musicEnabled) return;
    this.currentScene = scene;
    if (this.onStartMusic) {
      this.onStartMusic(0);
    }
  }

  public setMenuScene(scene: MenuScene | string) {
    this.currentScene = scene as MenuScene;
  }

  public stopMenuAmbient() {
    // Delegated to audioManager.stopMusic()
  }

  // Pure click/tap sounds ONLY - no complex procedural sweeps or drones
  public playNavTab(_tabId?: string) {
    // Click sound delegated
  }

  public playModalOpen(_modalName?: string) {
    // Click sound delegated
  }

  public playModalClose() {
    // Click sound delegated
  }

  public playNavAction(_pitchMultiplier: number = 1.0) {
    // Click sound delegated
  }

  public playNavConfirm() {
    // Click sound delegated
  }

  public playNavReject() {
    // Click sound delegated
  }

  public playNavHover() {
    // Click sound delegated
  }

  public playNavSound(_action: NavSoundAction, _context?: string) {
    // Click sound delegated
  }
}

export const soundscapeManager = new MenuSoundscapeEngine();
