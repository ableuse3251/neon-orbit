import React from 'react';
import { X, Volume2, VolumeX, Monitor, Globe, Bell, BellOff, Scale, EyeOff } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { api } from '../utils/api';
import { PWAInstallButton } from './PWAInstallButton';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 sm:pb-3 shrink-0">
          <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
            {t.settingsTitle}
          </h2>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Audio Volume Controls */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase">{t.audioTitle}</span>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-gray-300">
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
              className="accent-[#00f5d4] cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-gray-300">
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
              className="accent-[#00f5d4] cursor-pointer"
            />
          </div>
        </div>

        {/* Notifications & Haptics */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleNotifications}
            className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
              notificationsEnabled ? 'bg-[#00f5d4]/10 border-[#00f5d4]' : 'bg-[#0b071e] border-[#9d4edd]/20 text-gray-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {notificationsEnabled ? <Bell className="w-4 h-4 text-[#00f5d4]" /> : <BellOff className="w-4 h-4" />}
              <span>Alerts</span>
            </div>
            <span className="font-pixel text-[9px]">{notificationsEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={toggleHaptics}
            className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
              settings.hapticsEnabled ? 'bg-[#00f5d4]/10 border-[#00f5d4]' : 'bg-[#0b071e] border-[#9d4edd]/20 text-gray-400'
            }`}
          >
            <span>Vibration</span>
            <span className="font-pixel text-[9px]">{settings.hapticsEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Leaderboard Privacy Settings */}
        <button
          onClick={toggleHideLeaderboard}
          className={`min-h-[44px] p-3 rounded-lg border flex items-center justify-between text-xs transition-colors ${
            profile.hideFromLeaderboard ? 'bg-yellow-500/10 border-yellow-500 text-yellow-300' : 'bg-[#0b071e] border-[#9d4edd]/20 text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-[#00f5d4]" />
            <span>{t.hideLeaderboard}</span>
          </div>
          <span className="font-pixel text-[9px]">{profile.hideFromLeaderboard ? 'YES' : 'NO'}</span>
        </button>

        {/* Reduce Motion / Accessibility Settings */}
        <button
          onClick={() => {
            triggerHaptic('selection');
            onUpdateSettings({ ...settings, reduceMotion: !settings.reduceMotion });
          }}
          className={`min-h-[44px] p-3 rounded-lg border flex items-center justify-between text-xs transition-colors ${
            settings.reduceMotion ? 'bg-[#00f5d4]/15 border-[#00f5d4] text-[#00f5d4]' : 'bg-[#0b071e] border-[#9d4edd]/20 text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-[#00f5d4]" />
            <span>{t.reduceMotion}</span>
          </div>
          <span className="font-pixel text-[9px]">{settings.reduceMotion ? 'ON' : 'OFF'}</span>
        </button>

        {/* CRT Effect */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5 text-[#00f5d4]" />
            <span>{t.crtTitle}</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(['off', 'low', 'high'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCrt(mode)}
                className={`py-2 px-3 rounded-lg border font-pixel text-[10px] uppercase transition-colors ${
                  settings.crtIntensity === mode
                    ? 'bg-[#00f5d4] text-[#0b071e] font-bold border-[#00f5d4]'
                    : 'bg-[#0b071e] border-[#9d4edd]/30 text-gray-400 hover:text-white'
                }`}
              >
                {mode === 'off' ? t.crtOff : mode === 'low' ? t.crtLow : t.crtMax}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-pixel text-[#9d4edd] uppercase flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[#00f5d4]" />
            <span>{t.langTitle}</span>
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLang('en')}
              className={`py-2.5 px-3 rounded-lg border font-pixel text-xs transition-colors ${
                lang === 'en' ? 'bg-[#00f5d4] text-[#0b071e] font-bold' : 'bg-[#0b071e] border-[#9d4edd]/30 text-gray-400'
              }`}
            >
              ENGLISH
            </button>
            <button
              onClick={() => setLang('ru')}
              className={`py-2.5 px-3 rounded-lg border font-pixel text-xs transition-colors ${
                lang === 'ru' ? 'bg-[#00f5d4] text-[#0b071e] font-bold' : 'bg-[#0b071e] border-[#9d4edd]/30 text-gray-400'
              }`}
            >
              РУССКИЙ
            </button>
          </div>
        </div>

        {/* PWA App Install Button */}
        <PWAInstallButton lang={lang} className="w-full justify-center py-2.5 mt-1" />

        {/* Privacy Policy Link */}
        <button
          onClick={onOpenPrivacyPolicy}
          className="mt-1 py-2 text-center text-xs text-gray-400 hover:text-[#00f5d4] flex items-center justify-center gap-1.5"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>{lang === 'ru' ? 'Политика Конфиденциальности & Stars' : 'Privacy Policy & Stars Terms'}</span>
        </button>
      </div>
    </div>
  );
};
