import React from 'react';
import { Rocket, ShoppingBag, Trophy, Calendar, Award, Users } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { ModalType } from '../store/modalStore';
import { triggerHaptic } from '../utils/telegram';

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
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    color: string;
  }> = [
    {
      id: null,
      label: isRu ? 'ПОЛЕТ' : 'ORBIT',
      icon: Rocket,
      color: '#00f5d4',
    },
    {
      id: 'shop',
      label: isRu ? 'АНГАР' : 'HANGAR',
      icon: ShoppingBag,
      color: '#00f5d4',
    },
    {
      id: 'leaderboard',
      label: isRu ? 'ТОП' : 'RANKS',
      icon: Trophy,
      color: '#ffb703',
    },
    {
      id: 'streak',
      label: isRu ? 'ДЕЙЛИ' : 'DAILY',
      icon: Calendar,
      badge: `${profile.streakDays}d`,
      color: '#ff007f',
    },
    {
      id: 'achievements',
      label: isRu ? 'КВЕСТЫ' : 'QUESTS',
      icon: Award,
      badge: profile.unlockedAchievements?.length > 0 ? profile.unlockedAchievements.length : undefined,
      color: '#9d4edd',
    },
    {
      id: 'referrals',
      label: isRu ? 'ДРУЗЬЯ' : 'SQUAD',
      icon: Users,
      badge: profile.referralsCount > 0 ? profile.referralsCount : undefined,
      color: '#00f5d4',
    },
  ];

  return (
    <nav className="w-full bg-[#120a2e]/95 border-t border-[#9d4edd]/40 backdrop-blur-md z-30 font-mono-tech select-none shrink-0 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))]">
      <div className="max-w-md mx-auto grid grid-cols-6 gap-0.5 px-1 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeModal === tab.id;

          return (
            <button
              key={tab.id ?? 'orbit'}
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                onSelectTab(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 rounded-lg transition-all active:scale-95 ${
                isActive
                  ? 'bg-[#210b42] text-[#00f5d4] shadow-[0_0_12px_rgba(0,245,212,0.3)] border border-[#00f5d4]/40'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${
                    isActive ? 'scale-110 drop-shadow-[0_0_8px_#00f5d4]' : ''
                  }`}
                />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-[#ff007f] text-white font-pixel text-[7px] px-1 py-0.2 rounded-full leading-tight shadow-[0_0_6px_#ff007f]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`font-pixel text-[8px] sm:text-[9px] mt-0.5 tracking-tight truncate w-full text-center ${
                  isActive ? 'text-[#00f5d4] font-bold' : 'text-gray-400'
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
