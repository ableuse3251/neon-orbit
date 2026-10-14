import React from 'react';
import { X, Award, Zap, Trophy, Rocket } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getLevelFromXp } from '../utils/progression';
import { getTranslation } from '../utils/i18n';
import { MotionShipPreview, RankShield3D, StardustCrystalIcon } from './ui/Icons';

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

  const getRankTier = (level: number) => {
    if (level >= 50) return 'grandmaster';
    if (level >= 35) return 'master';
    if (level >= 25) return 'diamond';
    if (level >= 18) return 'platinum';
    if (level >= 10) return 'gold';
    if (level >= 5) return 'silver';
    return 'bronze';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e]/95 border-2 border-[#9d4edd] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(157,78,221,0.35)] flex flex-col gap-3.5 sm:gap-4 text-white max-h-[94vh] sm:max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#00f5d4] animate-pulse" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === 'ru' ? 'Бортовой Журнал Пилота' : 'Pilot Flight Logbook'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#210b42] text-gray-400 hover:text-white border border-[#9d4edd]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pilot ID Card with 3D Rank & Ship Motion Preview */}
        <div className="bg-[#0b071e] border-2 border-[#00f5d4]/60 rounded-xl p-4 flex flex-col gap-3 shadow-[0_0_20px_rgba(0,245,212,0.2)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RankShield3D tier={getRankTier(lvlInfo.level)} size={44} />
              <div className="flex flex-col">
                <span className="font-pixel text-sm text-white flex items-center gap-1.5 font-bold">
                  {profile.firstName}
                </span>
                <span className="text-[10px] text-[#ffb703] uppercase font-pixel mt-0.5">
                  {localizedRankTitle} • Lvl {lvlInfo.level}
                </span>
              </div>
            </div>

            {/* Stardust Crystal Badge */}
            <div className="flex items-center gap-1.5 bg-[#210b42] px-3 py-1.5 rounded-full border border-[#ffb703]/50 text-[#ffb703] shadow-[0_0_10px_rgba(255,183,3,0.3)]">
              <StardustCrystalIcon size={16} />
              <span className="font-pixel text-xs font-bold">{profile.stardust}</span>
            </div>
          </div>

          {/* Equipped Ship 3D Interactive Showcase */}
          <div className="relative w-full h-28 bg-[#120a2e]/90 rounded-lg border border-[#9d4edd]/40 flex items-center justify-between px-4 overflow-hidden">
            <div className="flex flex-col z-10">
              <span className="text-[9px] font-pixel text-gray-400 uppercase">Equipped Vessel</span>
              <span className="text-xs font-pixel text-[#00f5d4] font-bold mt-0.5">
                {profile.selectedShip.replace('ship_', '').replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[8px] font-mono-tech text-gray-400 mt-1">
                ⚡ Motion Engine Synchronized
              </span>
            </div>

            <div className="z-10">
              <MotionShipPreview
                shipId={profile.selectedShip}
                color="#00f5d4"
                accentColor="#ff007f"
                size={85}
              />
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-pixel text-gray-300">
              <span>XP: {lvlInfo.currentXp} / {lvlInfo.nextLevelXp}</span>
              <span className="text-[#00f5d4] font-bold">{lvlInfo.progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-[#120a2e] rounded-full overflow-hidden border border-[#9d4edd]/40 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#00f5d4] to-[#9d4edd] rounded-full shadow-[0_0_10px_#00f5d4] transition-all duration-300"
                style={{ width: `${lvlInfo.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#ffb703]" />
              <span>{t.record}</span>
            </span>
            <span className="font-pixel text-lg text-[#00f5d4] font-bold">
              {profile.highScore.toLocaleString()}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-[#ff007f]" />
              <span>{profile.lang === 'ru' ? 'Всего Раундов' : 'Total Rounds'}</span>
            </span>
            <span className="font-pixel text-lg text-white font-bold">
              {profile.totalRounds}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#ffb703]" />
              <span>{profile.lang === 'ru' ? 'Достижения' : 'Achievements'}</span>
            </span>
            <span className="font-pixel text-lg text-[#ffb703] font-bold">
              {profile.unlockedAchievements.length} / 30
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#210b42] border border-[#9d4edd]/30 flex flex-col gap-1 shadow-sm">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ff007f]" />
              <span>{profile.lang === 'ru' ? 'Стрик Дней' : 'Streak Days'}</span>
            </span>
            <span className="font-pixel text-lg text-white font-bold">
              {profile.streakDays}d
            </span>
          </div>
        </div>

        {/* Collection Summary */}
        <div className="bg-[#0b071e] border border-[#9d4edd]/30 rounded-xl p-3 flex items-center justify-between text-xs shadow-sm">
          <span className="text-gray-300 font-mono-tech">
            {profile.lang === 'ru' ? 'Коллекция Ангара:' : 'Hangar Collection:'}
          </span>
          <span className="font-pixel text-[#00f5d4] text-xs font-bold">
            {profile.unlockedShips.length} {profile.lang === 'ru' ? 'Кораблей' : 'Ships'}
          </span>
        </div>
      </div>
    </div>
  );
};
