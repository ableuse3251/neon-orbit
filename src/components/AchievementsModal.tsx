import React, { useState } from 'react';
import { Check, Lock, Sparkles, Trophy } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { ACHIEVEMENTS_LIST, getAchievementProgress } from '../utils/progression';
import { triggerHaptic } from '../utils/telegram';
import { StardustCrystalIcon } from './ui/Icons';
import { KokonutModal, KokonutTabs, KokonutCard, KokonutProgress, KokonutButton, KokonutBadge } from './ui/kokonut';

interface AchievementsModalProps {
  profile: PlayerProfile;
  onClaimAchievement: (achievementId: string, rewardStardust: number, rewardXp: number) => Promise<void> | void;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  profile,
  onClaimAchievement,
  onClose,
}) => {
  const isRu = profile.lang === 'ru';
  const [filter, setFilter] = useState<'all' | 'combat' | 'combo' | 'veteran' | 'streak'>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const filteredAchievements = ACHIEVEMENTS_LIST.filter((ach) =>
    filter === 'all' ? true : ach.category === filter
  );

  const totalUnlockedCount = ACHIEVEMENTS_LIST.filter((ach) =>
    profile.unlockedAchievements?.includes(ach.id)
  ).length;

  const handleClaim = async (achId: string, dust: number, xp: number) => {
    if (claimingId) return;
    setClaimingId(achId);
    try {
      triggerHaptic('success');
      await onClaimAchievement(achId, dust, xp);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={isRu ? 'Достижения Пилота' : 'Pilot Achievements'}
      icon={<Trophy className="w-5 h-5 text-[#ffb703] animate-bounce" />}
      badge={
        <KokonutBadge variant="cyan" size="sm">
          {totalUnlockedCount} / {ACHIEVEMENTS_LIST.length}
        </KokonutBadge>
      }
      subtitle={
        isRu
          ? 'Пожизненные награды • Выдаются 1 раз за игру и не сбрасываются'
          : 'Lifetime milestones • Claimable once per game, never resets'
      }
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3">
        {/* Filter Categories */}
        <KokonutTabs
          tabs={[
            { id: 'all', label: isRu ? 'ВСЕ' : 'ALL' },
            { id: 'combat', label: isRu ? 'БОЙ' : 'COMBAT' },
            { id: 'combo', label: isRu ? 'КОМБО' : 'COMBOS' },
            { id: 'veteran', label: isRu ? 'ВЕТЕРАН' : 'VETERAN' },
            { id: 'streak', label: isRu ? 'СЕРИЯ' : 'STREAK' },
          ]}
          activeTab={filter}
          onChange={(f) => setFilter(f as 'all' | 'combat' | 'combo' | 'veteran' | 'streak')}
          layoutId="achievementsFilterTabs"
        />

        {/* Achievements Cards List */}
        <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredAchievements.map((ach) => {
            const isUnlocked = profile.unlockedAchievements?.includes(ach.id);
            const isClaimed = (profile as any).claimedAchievements?.includes(ach.id);
            const { currentValue, targetValue } = getAchievementProgress(ach, profile);
            const percentage = Math.min(100, Math.round((currentValue / targetValue) * 100));

            return (
              <KokonutCard
                key={ach.id}
                variant={isUnlocked && !isClaimed ? 'glow' : 'glass'}
                hoverEffect={!isClaimed}
                className="p-3.5 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#14082b] border border-[#00f5d4]/40 flex items-center justify-center font-bold text-lg shrink-0">
                      {ach.icon || '🏆'}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-pixel text-xs text-white font-bold truncate">
                          {isRu ? ach.titleRu : ach.titleEn}
                        </h4>
                        <KokonutBadge variant={isUnlocked ? 'cyan' : 'glass'} size="sm">
                          {ach.category}
                        </KokonutBadge>
                      </div>
                      <p className="text-[11px] text-gray-400 font-sans truncate">
                        {isRu ? ach.descRu : ach.descEn}
                      </p>
                    </div>
                  </div>

                  {/* Claim Button / Status Badge */}
                  {isClaimed ? (
                    <KokonutBadge variant="glass" size="md" icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}>
                      CLAIMED
                    </KokonutBadge>
                  ) : isUnlocked ? (
                    <KokonutButton
                      variant="glow"
                      size="sm"
                      isLoading={claimingId === ach.id}
                      onClick={() => handleClaim(ach.id, ach.rewardStardust, ach.rewardXp)}
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                    >
                      {isRu ? 'ЗАБРАТЬ' : 'CLAIM'}
                    </KokonutButton>
                  ) : (
                    <KokonutBadge variant="glass" size="md" icon={<Lock className="w-3.5 h-3.5 text-gray-500" />}>
                      LOCKED
                    </KokonutBadge>
                  )}
                </div>

                {/* Progress Bar & Rewards info */}
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <KokonutProgress value={currentValue} max={targetValue} size="sm" />

                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <span>
                      {currentValue} / {targetValue} ({percentage}%)
                    </span>
                    <span className="flex items-center gap-1 font-bold text-[#ffb703]">
                      <StardustCrystalIcon size={12} color="#ffb703" />
                      +{ach.rewardStardust} STARDUST • +{ach.rewardXp} XP
                    </span>
                  </div>
                </div>
              </KokonutCard>
            );
          })}
        </div>
      </div>
    </KokonutModal>
  );
};
