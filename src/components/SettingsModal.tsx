import React, { useState } from 'react';
import { Volume2, Monitor, Globe, Bell, Scale, EyeOff, Sliders, Music, Disc3 } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import { audioManager } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { KokonutModal, KokonutSwitch, KokonutButton, KokonutCard, KokonutBadge } from './ui/kokonut';

interface SettingsModalProps {
  profile: PlayerProfile;
  onUpdateSettings: (settings: PlayerProfile['settings']) => void;
  onUpdateNotifications: (enabled: boolean) => void;
  onUpdateLang: (lang: 'en' | 'ru') => void;
  onOpenPrivacyPolicy: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  onUpdateSettings,
  onUpdateNotifications,
  onUpdateLang,
  onOpenPrivacyPolicy,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const { settings, lang, notificationsEnabled } = profile;

  const tracks = audioManager.getTracks();
  const [currentTrack, setCurrentTrack] = useState(audioManager.getCurrentTrack());

  const selectTrack = (id: number) => {
    triggerHaptic('selection');
    audioManager.selectTrack(id);
    setCurrentTrack(audioManager.getCurrentTrack());
  };

  const setFxVolume = (val: number) => {
    onUpdateSettings({ ...settings, volumeFx: val, soundFx: val > 0 });
  };

  const setMusicVolume = (val: number) => {
    onUpdateSettings({ ...settings, volumeMusic: val, music: val > 0 });
  };

  const toggleHaptics = () => {
    onUpdateSettings({ ...settings, hapticsEnabled: !settings.hapticsEnabled });
  };

  const toggleNotifications = async () => {
    triggerHaptic('selection');
    const newVal = !notificationsEnabled;
    onUpdateNotifications(newVal);
    try {
      await api.updateUserSettings({ notificationsEnabled: newVal });
    } catch (err) {
      console.error('Failed to update notifications setting:', err);
    }
  };

  const setCrt = (mode: 'off' | 'low' | 'high') => {
    triggerHaptic('selection');
    onUpdateSettings({ ...settings, crtIntensity: mode });
  };

  const setLang = (newLang: 'en' | 'ru') => {
    triggerHaptic('selection');
    onUpdateLang(newLang);
  };

  const toggleHideLeaderboard = async () => {
    triggerHaptic('selection');
    const newVal = !profile.hideFromLeaderboard;
    onUpdateSettings({ ...settings, hideFromLeaderboard: newVal });
    try {
      await api.updateUserSettings({ hideFromLeaderboard: newVal });
    } catch (err) {
      console.error('Failed to update leaderboard privacy:', err);
    }
  };

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={t.settingsTitle}
      icon={<Sliders className="w-5 h-5" />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        {/* Audio Volume Controls Card */}
        <KokonutCard variant="glow" hoverEffect={false} className="flex flex-col gap-3">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-[#00f5d4]" />
            <span>{t.audioTitle}</span>
          </span>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-gray-300 font-semibold">
              <span>{t.soundFx}</span>
              <span className="font-pixel text-[#00f5d4]">{Math.round((settings.volumeFx ?? 0.8) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.volumeFx ?? 0.8}
              onChange={(e) => setFxVolume(parseFloat(e.target.value))}
              className="accent-[#00f5d4] cursor-pointer h-2 bg-[#0d0622] rounded-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs text-gray-300 font-semibold">
              <span>{t.musicTrack}</span>
              <span className="font-pixel text-[#00f5d4]">{Math.round((settings.volumeMusic ?? 0.6) * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={settings.volumeMusic ?? 0.6}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="accent-[#00f5d4] cursor-pointer h-2 bg-[#0d0622] rounded-lg"
            />
          </div>

          {/* Royalty-Free Synthwave Music Track Selector (Pixabay & BreakingCopyright) */}
          <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-[#00f5d4]/15">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
              <span className="flex items-center gap-1.5 text-[#00f5d4] font-pixel text-[10px]">
                <Music className="w-3.5 h-3.5 text-[#ff007f]" />
                <span>{lang === 'ru' ? 'СИНТВЕЙВ ТРЕК' : 'SYNTHWAVE TRACK'}</span>
              </span>
              <span className="text-[9px] text-[#ff007f] font-mono-tech uppercase font-bold">
                {currentTrack.source}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {tracks.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => selectTrack(tr.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                    currentTrack.id === tr.id
                      ? 'bg-[#00f5d4]/15 border-[#00f5d4] text-white shadow-[0_0_12px_rgba(0,245,212,0.3)]'
                      : 'bg-[#050212]/60 border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-100 flex items-center gap-1">
                      {currentTrack.id === tr.id && <Disc3 className="w-3 h-3 text-[#00f5d4] animate-spin" />}
                      <span>{tr.title}</span>
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono-tech">{tr.genre} • {tr.bpm} BPM</span>
                  </div>
                  <KokonutBadge
                    variant={tr.id % 2 === 0 ? 'cyan' : 'pink'}
                    size="sm"
                    className="text-[8px] py-0.5 px-1.5 font-pixel uppercase"
                  >
                    {tr.source}
                  </KokonutBadge>
                </button>
              ))}
            </div>
          </div>
        </KokonutCard>

        {/* Kokonut Switches */}
        <div className="flex flex-col gap-2.5">
          <KokonutSwitch
            checked={notificationsEnabled}
            onChange={toggleNotifications}
            label="Push Alerts"
            description="Daily rewards & event notifications"
          />

          {/* Haptic Feedback Intensity Selection */}
          <KokonutCard variant="glass" hoverEffect={false} className="flex flex-col gap-2">
            <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#00f5d4]" />
              <span>{profile.lang === 'ru' ? 'ИНТЕНСИВНОСТЬ ВИБРООТКЛИКА' : 'HAPTIC FEEDBACK INTENSITY'}</span>
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['off', 'low', 'medium', 'high'] as const).map((level) => {
                const currentIntensity = settings.hapticIntensity || (settings.hapticsEnabled ? 'high' : 'off');
                const isSelected = currentIntensity === level;
                return (
                  <KokonutButton
                    key={level}
                    variant={isSelected ? 'glow' : 'glass'}
                    size="sm"
                    onClick={() => {
                      triggerHaptic('selection');
                      onUpdateSettings({
                        ...settings,
                        hapticIntensity: level,
                        hapticsEnabled: level !== 'off',
                      });
                    }}
                    className="w-full font-pixel text-[9px] uppercase"
                  >
                    {level === 'off' ? (profile.lang === 'ru' ? 'ВЫКЛ' : 'OFF') :
                     level === 'low' ? (profile.lang === 'ru' ? 'НИЗК' : 'LOW') :
                     level === 'medium' ? (profile.lang === 'ru' ? 'СРЕД' : 'MED') :
                     (profile.lang === 'ru' ? 'ВЫСОК' : 'HIGH')}
                  </KokonutButton>
                );
              })}
            </div>
          </KokonutCard>

          <KokonutSwitch
            checked={!!profile.hideFromLeaderboard}
            onChange={toggleHideLeaderboard}
            label={t.hideLeaderboard}
            description="Incognito mode on global hall of fame"
          />

          <KokonutSwitch
            checked={!!settings.reduceMotion}
            onChange={() => {
              triggerHaptic('selection');
              onUpdateSettings({ ...settings, reduceMotion: !settings.reduceMotion });
            }}
            label={t.reduceMotion}
            description="Disable ambient animations for lower latency"
          />
        </div>

        {/* CRT Retro Filter Card */}
        <KokonutCard variant="glass" hoverEffect={false} className="flex flex-col gap-2">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-[#00f5d4]" />
            <span>{t.crtTitle}</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['off', 'low', 'high'] as const).map((mode) => (
              <KokonutButton
                key={mode}
                variant={settings.crtIntensity === mode ? 'glow' : 'glass'}
                size="sm"
                onClick={() => setCrt(mode)}
                className="w-full font-pixel text-[10px]"
              >
                {mode === 'off' ? t.crtOff : mode === 'low' ? t.crtLow : t.crtMax}
              </KokonutButton>
            ))}
          </div>
        </KokonutCard>

        {/* Language Selection Card */}
        <KokonutCard variant="glass" hoverEffect={false} className="flex flex-col gap-2">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[#00f5d4]" />
            <span>{t.langTitle}</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <KokonutButton
              variant={lang === 'en' ? 'glow' : 'glass'}
              size="sm"
              onClick={() => setLang('en')}
              className="w-full font-pixel"
            >
              ENGLISH
            </KokonutButton>
            <KokonutButton
              variant={lang === 'ru' ? 'glow' : 'glass'}
              size="sm"
              onClick={() => setLang('ru')}
              className="w-full font-pixel"
            >
              РУССКИЙ
            </KokonutButton>
          </div>
        </KokonutCard>

        {/* PWA App Install Button */}
        <PWAInstallButton lang={lang} className="w-full justify-center py-2.5 mt-1" />

        {/* Privacy Policy Link */}
        <button
          onClick={onOpenPrivacyPolicy}
          className="mt-1 py-2 text-center text-xs text-gray-400 hover:text-[#00f5d4] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>{lang === 'ru' ? 'Политика Конфиденциальности & Stars' : 'Privacy Policy & Stars Terms'}</span>
        </button>
      </div>
    </KokonutModal>
  );
};
