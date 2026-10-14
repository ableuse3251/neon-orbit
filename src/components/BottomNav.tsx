import React from 'react';
import { PlayerProfile } from '../types/game';
import { ModalType } from '../store/modalStore';
import { triggerHaptic } from '../utils/telegram';
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
    <nav className="w-full bg-[#0d0722]/95 border-t border-[#00f5d4]/30 backdrop-blur-xl z-30 font-mono-tech select-none shrink-0 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
      <div className="max-w-md mx-auto grid grid-cols-6 gap-0.5 px-1.5 py-1.5">
        {tabs.map((tab) => {

          const IconComponent = tab.icon;
          const isActive = activeModal === tab.id;

          return (
            <button
              key={tab.id ?? 'orbit'}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onSelectTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-0.5 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'bg-[#1c0d38] text-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.35)] border border-[#00f5d4]/60'
                  : 'text-gray-400 hover:text-white border border-transparent hover:bg-white/5'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <IconComponent
                  size={20}
                  color={isActive ? tab.color : '#8e8a9f'}
                  glowColor={isActive ? tab.color : undefined}
                  className={isActive ? 'scale-110' : 'opacity-80 hover:opacity-100'}
                />

                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#ff007f] text-white font-pixel text-[7px] px-1 py-0.2 rounded-full leading-tight shadow-[0_0_8px_#ff007f] font-bold">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`font-pixel text-[8px] sm:text-[9px] mt-1 tracking-tight truncate w-full text-center transition-colors ${
                  isActive ? 'text-[#00f5d4] font-bold text-glow-cyan' : 'text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
