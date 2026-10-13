import React, { useState } from 'react';
import { X, Award, Check, Sparkles, Filter } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { ACHIEVEMENTS_LIST } from '../utils/progression';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

interface AchievementsModalProps {
  profile: PlayerProfile;
  onClaimAchievement: (achievementId: string, rewardStardust: number, rewardXp: number) => void;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  profile,
  onClaimAchievement,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const [filter, setFilter] = useState<'all' | 'combat' | 'combo' | 'veteran' | 'streak'>('all');

  const filteredAchievements = ACHIEVEMENTS_LIST.filter((ach) =>
    filter === 'all' ? true : ach.category === filter
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#00f5d4]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === 'ru' ? 'Достижения (30)' : 'Achievements (30)'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-1 bg-[#0b071e] p-1 rounded-lg border border-[#9d4edd]/30 overflow-x-auto">
          {(['all', 'combat', 'combo', 'veteran', 'streak'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                triggerHaptic('selection');
                setFilter(cat);
              }}
              className={`py-1 px-2.5 rounded-md font-pixel text-[9px] uppercase whitespace-nowrap transition-colors ${
                filter === cat ? 'bg-[#00f5d4] text-[#0b071e] font-bold' : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat === 'all'
                ? 'ALL'
                : cat === 'combat'
                ? 'COMBAT'
                : cat === 'combo'
                ? 'COMBOS'
                : cat === 'veteran'
                ? 'VETERAN'
                : 'STREAK'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
          {filteredAchievements.map((ach) => {
            const isUnlocked = profile.unlockedAchievements.includes(ach.id);
            const title = profile.lang === 'ru' ? ach.titleRu : ach.titleEn;
            const desc = profile.lang === 'ru' ? ach.descRu : ach.descEn;

            return (
              <div
                key={ach.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  isUnlocked
                    ? 'bg-[#00f5d4]/10 border-[#00f5d4]'
                    : 'bg-[#0b071e] border-[#9d4edd]/20 opacity-80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-lg bg-[#210b42] border border-[#9d4edd]/30">
                    {ach.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-pixel text-xs text-white flex items-center gap-1.5">
                      {title}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{desc}</span>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] font-pixel text-[#ffb703]">
                      <span>+{ach.rewardStardust} 🌟 Stardust</span>
                      <span>+{ach.rewardXp} XP</span>
                    </div>
                  </div>
                </div>

                {isUnlocked ? (
                  <span className="p-2 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4] text-[#00f5d4]">
                    <Check className="w-4 h-4" />
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      triggerHaptic('success');
                      onClaimAchievement(ach.id, ach.rewardStardust, ach.rewardXp);
                    }}
                    className="py-1.5 px-3 bg-[#ff007f] hover:bg-[#ff007f]/90 text-white font-pixel text-[9px] font-bold rounded-md shrink-0 shadow-[0_0_10px_#ff007f]"
                  >
                    CLAIM
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
