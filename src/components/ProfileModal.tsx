import React from 'react';
import { X, Award, Zap, Sparkles, Trophy, Crosshair, Rocket, Shield } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getLevelFromXp } from '../utils/progression';
import { getTranslation } from '../utils/i18n';

interface ProfileModalProps {
  profile: PlayerProfile;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose }) => {
  const t = getTranslation(profile.lang);
  const lvlInfo = getLevelFromXp(profile.xp);

  const localizedRankTitle =
    profile.rankTitle === 'Fleet Admiral'
      ? t.rankAdmiral
      : profile.rankTitle === 'Commander'
      ? t.rankCommander
      : t.rankPilot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === 'ru' ? 'Бортовой Журнал Пилота' : 'Pilot Flight Logbook'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Level & XP Card */}
        <div className="bg-[#0b071e] border border-[#00f5d4] rounded-xl p-4 flex flex-col gap-3 shadow-[0_0_15px_rgba(0,245,212,0.15)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#210b42] border-2 border-[#00f5d4] flex items-center justify-center font-pixel text-lg text-[#00f5d4] font-bold shadow-[0_0_10px_#00f5d4]">
                {lvlInfo.level}
              </div>
              <div className="flex flex-col">
                <span className="font-pixel text-sm text-white flex items-center gap-1.5">
                  {profile.firstName}
                </span>
                <span className="text-[10px] text-[#ffb703] uppercase font-pixel mt-0.5">
                  {localizedRankTitle}
                </span>
              </div>
            </div>

            {/* Stardust Badge */}
            <div className="flex items-center gap-1.5 bg-[#210b42] px-3 py-1.5 rounded-full border border-[#ffb703]/50 text-[#ffb703]">
              <Sparkles className="w-4 h-4" />
              <span className="font-pixel text-xs font-bold">{profile.stardust}</span>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-pixel text-gray-400">
              <span>XP: {lvlInfo.currentXp} / {lvlInfo.nextLevelXp}</span>
              <span>{lvlInfo.progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#120a2e] rounded-full overflow-hidden border border-[#9d4edd]/30">
              <div
                className="h-full bg-[#00f5d4] shadow-[0_0_8px_#00f5d4] transition-all duration-300"
                style={{ width: `${lvlInfo.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-lg bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-[#ffb703]" />
              <span>{t.record}</span>
            </span>
            <span className="font-pixel text-lg text-[#00f5d4] font-bold">
              {profile.highScore.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Rocket className="w-3.5 h-3.5 text-[#ff007f]" />
              <span>{profile.lang === 'ru' ? 'Всего Раундов' : 'Total Rounds'}</span>
            </span>
            <span className="font-pixel text-lg text-white font-bold">
              {profile.totalRounds}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#00f5d4]" />
              <span>{profile.lang === 'ru' ? 'Достижения' : 'Achievements'}</span>
            </span>
            <span className="font-pixel text-lg text-[#ffb703] font-bold">
              {profile.unlockedAchievements.length} / 30
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#ffb703]" />
              <span>{profile.lang === 'ru' ? 'Стрик Дней' : 'Streak Days'}</span>
            </span>
            <span className="font-pixel text-lg text-white font-bold">
              {profile.streakDays}d
            </span>
          </div>
        </div>

        {/* Collection Summary */}
        <div className="bg-[#0b071e] border border-[#9d4edd]/20 rounded-lg p-3 flex items-center justify-between text-xs">
          <span className="text-gray-300">
            {profile.lang === 'ru' ? 'Коллекция Ангара:' : 'Hangar Collection:'}
          </span>
          <span className="font-pixel text-[#00f5d4] text-xs">
            {profile.unlockedShips.length} {profile.lang === 'ru' ? 'Кораблей' : 'Ships'}
          </span>
        </div>
      </div>
    </div>
  );
};
