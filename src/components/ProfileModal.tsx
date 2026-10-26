import React from 'react';
import { Award, Zap, Trophy, Rocket } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getLevelFromXp } from '../utils/progression';
import { getTranslation } from '../utils/i18n';
import { MotionShipPreview, RankShield3D, StardustCrystalIcon } from './ui/Icons';
import { KokonutModal, KokonutCard, KokonutProgress, KokonutBadge } from './ui/kokonut';

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
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={profile.lang === 'ru' ? 'Бортовой Журнал Пилота' : 'Pilot Flight Logbook'}
      icon={<Award className="w-5 h-5 text-[#00f5d4] animate-pulse" />}
      badge={
        <KokonutBadge variant="gold" size="sm" icon={<StardustCrystalIcon size={12} />}>
          {profile.stardust}
        </KokonutBadge>
      }
      maxWidth="md"
    >
      <div className="flex flex-col gap-3.5">
        {/* Pilot ID Card with 3D Rank & Ship Motion Preview */}
        <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RankShield3D tier={getRankTier(lvlInfo.level)} size={44} />
              <div className="flex flex-col">
                <span className="font-pixel text-sm text-white flex items-center gap-1.5 font-bold">
                  {profile.firstName || profile.username}
                </span>
                <KokonutBadge variant="gold" size="sm" className="mt-1">
                  {localizedRankTitle} • Lvl {lvlInfo.level}
                </KokonutBadge>
              </div>
            </div>
          </div>

          {/* Equipped Ship Showcase */}
          <div className="relative w-full h-28 bg-[#090317] rounded-2xl border border-[#00f5d4]/30 flex items-center justify-between px-4 overflow-hidden">
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
          <div className="flex flex-col gap-1.5">
            <KokonutProgress
              value={lvlInfo.currentXp}
              max={lvlInfo.nextLevelXp}
              showLabel={true}
              label={`XP: ${lvlInfo.currentXp} / ${lvlInfo.nextLevelXp}`}
            />
          </div>
        </KokonutCard>

        {/* Lifetime Statistics Bento Cards Grid */}
        <div className="grid grid-cols-2 gap-2">
          <KokonutCard variant="glass" hoverEffect={true} className="p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Trophy className="w-3.5 h-3.5 text-[#00f5d4]" />
              <span className="font-pixel text-[10px]">{t.record || 'HIGH SCORE'}</span>
            </div>
            <span className="font-pixel text-sm text-[#00f5d4] font-bold tabular-nums">
              {profile.highScore.toLocaleString()}
            </span>
          </KokonutCard>

          <KokonutCard variant="glass" hoverEffect={true} className="p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Rocket className="w-3.5 h-3.5 text-[#ff007f]" />
              <span className="font-pixel text-[10px]">TOTAL ROUNDS</span>
            </div>
            <span className="font-pixel text-sm text-white font-bold tabular-nums">
              {profile.totalRounds || 0}
            </span>
          </KokonutCard>

          <KokonutCard variant="glass" hoverEffect={true} className="p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Zap className="w-3.5 h-3.5 text-[#ffb703]" />
              <span className="font-pixel text-[10px]">STREAK DAYS</span>
            </div>
            <span className="font-pixel text-sm text-[#ffb703] font-bold tabular-nums">
              {profile.streakDays || 0} DAYS
            </span>
          </KokonutCard>

          <KokonutCard variant="glass" hoverEffect={true} className="p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs">
              <Award className="w-3.5 h-3.5 text-[#9d4edd]" />
              <span className="font-pixel text-[10px]">ACHIEVEMENTS</span>
            </div>
            <span className="font-pixel text-sm text-[#9d4edd] font-bold tabular-nums">
              {profile.unlockedAchievements?.length || 0}
            </span>
          </KokonutCard>
        </div>
      </div>
    </KokonutModal>
  );
};
