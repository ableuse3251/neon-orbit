import React from 'react';
import { motion } from 'motion/react';
import { PlayerProfile } from '../types/game';
import { ModalType } from '../store/modalStore';
import { triggerHaptic } from '../utils/telegram';
import { audioManager } from '../utils/audio';
import {
  OrbitRocketIcon,
  HangarShipIcon,
  RanksCrownIcon,
  DailyStreakIcon,
  QuestsTargetIcon,
  SquadUsersIcon,
} from './ui/Icons';

interface BottomNavProps {
  profile: PlayerProfile;
  activeModal: ModalType | null;
  onSelectTab: (tab: ModalType | null) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  profile,
  activeModal,
  onSelectTab,
}) => {
  const isRu = profile.lang === 'ru';

  const tabs: Array<{
    id: ModalType | null;
    label: string;
    icon: React.FC<{ size?: number; color?: string; glowColor?: string; className?: string }>;
    badge?: string | number;
    color: string;
  }> = [
    {
      id: null,
      label: isRu ? 'ПОЛЕТ' : 'ORBIT',
      icon: OrbitRocketIcon,
      color: '#00f5d4',
    },
    {
      id: 'shop',
      label: isRu ? 'АНГАР' : 'HANGAR',
      icon: HangarShipIcon,
      color: '#00f5d4',
    },
    {
      id: 'leaderboard',
      label: isRu ? 'ТОП' : 'RANKS',
      icon: RanksCrownIcon,
      color: '#ffb703',
    },
    {
      id: 'streak',
      label: isRu ? 'ДЕЙЛИ' : 'DAILY',
      icon: DailyStreakIcon,
      badge:
        profile.lastDailyClaimDate === new Date().toISOString().split('T')[0] ||
        profile.isDailyRewardClaimedToday
          ? `${profile.streakDays}d`
          : '🎁',
      color: '#ff007f',
    },
    {
      id: 'achievements',
      label: isRu ? 'КВЕСТЫ' : 'QUESTS',
      icon: QuestsTargetIcon,
      badge:
        profile.unlockedAchievements?.length > 0
          ? profile.unlockedAchievements.length
          : undefined,
      color: '#9d4edd',
    },
    {
      id: 'referrals',
      label: isRu ? 'ДРУЗЬЯ' : 'SQUAD',
      icon: SquadUsersIcon,
      badge: profile.referralsCount > 0 ? profile.referralsCount : undefined,
      color: '#00f5d4',
    },
  ];

  return (
    <nav className="relative w-full bg-[#080417]/95 border-t border-[#00f5d4]/25 backdrop-blur-2xl z-30 font-mono-tech select-none shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_rgba(0,0,0,0.85)]">
      {/* Top Subtle Beam Light Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f5d4]/60 to-transparent pointer-events-none" />

      <div className="max-w-md mx-auto grid grid-cols-6 gap-1 px-2 py-1.5">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeModal === tab.id;

          return (
            <motion.button
              key={tab.id ?? 'orbit'}
              type="button"
              whileTap={{ scale: 0.92 }}
              onMouseEnter={() => audioManager.playNavHover()}
              onClick={() => {
                audioManager.playNavTab(tab.id || 'orbit');
                triggerHaptic('selection');
                onSelectTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-colors group ${
                isActive
                  ? 'text-[#00f5d4]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {/* Motion Layout Active Background Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeBottomNavPill"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className="absolute inset-0 bg-gradient-to-b from-[#1b0c3f] to-[#12072e] rounded-2xl border border-[#00f5d4]/70 shadow-[0_0_20px_rgba(0,245,212,0.3)] z-0"
                />
              )}

              {/* Active Indicator Top Glow Line */}
              {isActive && (
                <motion.div
                  layoutId="activeBottomNavGlow"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute -top-[1px] left-1/4 right-1/4 h-[2px] rounded-full shadow-[0_0_8px_currentColor] z-10"
                  style={{ backgroundColor: tab.color, color: tab.color }}
                />
              )}

              <div className="relative z-10 flex items-center justify-center">
                <IconComponent
                  size={21}
                  color={isActive ? tab.color : '#8e8a9f'}
                  glowColor={isActive ? tab.color : undefined}
                  className={`transition-transform duration-200 ${
                    isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(0,245,212,0.8)]' : 'group-hover:scale-105 group-hover:opacity-100 opacity-80'
                  }`}
                />

                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-2 -right-3 text-white font-pixel text-[7px] px-1.5 py-0.3 rounded-full leading-tight shadow-[0_0_10px_#ff007f] font-bold border border-black/80 ${
                      tab.badge === '🎁' ? 'bg-[#ff007f] animate-bounce' : 'bg-gradient-to-r from-[#ff007f] to-[#9d4edd]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`relative z-10 font-pixel text-[8px] sm:text-[9px] mt-1 tracking-tight truncate w-full text-center transition-all ${
                  isActive ? 'text-[#00f5d4] font-bold text-glow-cyan scale-105' : 'text-gray-400 group-hover:text-gray-200'
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
