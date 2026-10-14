import React, { useState } from 'react';
import { X, Award, Check, Lock, Sparkles, Trophy } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { ACHIEVEMENTS_LIST, getAchievementProgress } from '../utils/progression';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-lg bg-[#120a2e] border-2 border-[#9d4edd] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(157,78,221,0.35)] flex flex-col gap-3.5 text-white max-h-[94vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#9d4edd]/20 border border-[#9d4edd]/50 shadow-[0_0_12px_rgba(157,78,221,0.3)]">
              <Trophy className="w-5 h-5 text-[#00f5d4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-pixel text-xs sm:text-sm text-[#00f5d4] uppercase tracking-wider">
                  {isRu ? 'ДОСТИЖЕНИЯ ПИЛОТА' : 'PILOT ACHIEVEMENTS'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[#210b42] border border-[#00f5d4]/40 font-pixel text-[10px] text-[#00f5d4]">
                  {totalUnlockedCount} / {ACHIEVEMENTS_LIST.length}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isRu
                  ? 'Пожизненные награды • Выдаются 1 раз за игру и не сбрасываются'
                  : 'Lifetime milestones • Claimable once per game, never resets'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#210b42] text-gray-400 hover:text-white hover:bg-[#341266] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-1.5 bg-[#0b071e] p-1 rounded-xl border border-[#9d4edd]/30 overflow-x-auto shrink-0 scrollbar-none">
          {(
            [
              { id: 'all', en: 'ALL', ru: 'ВСЕ' },
              { id: 'combat', en: 'COMBAT', ru: 'БОЙ' },
              { id: 'combo', en: 'COMBOS', ru: 'КОМБО' },
              { id: 'veteran', en: 'VETERAN', ru: 'ВЕТЕРАН' },
              { id: 'streak', en: 'STREAK', ru: 'СЕРИЯ' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                triggerHaptic('selection');
                setFilter(cat.id);
              }}
              className={`py-1.5 px-3 rounded-lg font-pixel text-[9px] uppercase whitespace-nowrap transition-all ${
                filter === cat.id
                  ? 'bg-[#00f5d4] text-[#0b071e] font-bold shadow-[0_0_10px_rgba(0,245,212,0.4)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {isRu ? cat.ru : cat.en}
            </button>
          ))}
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[58vh] scrollbar-thin scrollbar-thumb-[#9d4edd]/40">
          {filteredAchievements.map((ach) => {
            const prog = getAchievementProgress(ach, profile);
            const title = isRu ? ach.titleRu : ach.titleEn;
            const desc = isRu ? ach.descRu : ach.descEn;

            return (
              <div
                key={ach.id}
                className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all ${
                  prog.isClaimed
                    ? 'bg-emerald-950/20 border-emerald-500/40 opacity-80'
                    : prog.canClaim
                    ? 'bg-[#00f5d4]/10 border-2 border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.25)] animate-pulse'
                    : 'bg-[#0b071e]/85 border-[#9d4edd]/25 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-[#210b42] border border-[#9d4edd]/40 shrink-0">
                      {ach.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-pixel text-xs text-white font-bold flex items-center gap-1.5">
                        {title}
                      </span>
                      <span className="text-[11px] text-gray-300 mt-0.5 leading-tight">{desc}</span>
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-pixel text-[#ffb703]">
                        <span>+{ach.rewardStardust} 🌟 Stardust</span>
                        <span>+{ach.rewardXp} XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Status / Claim Button */}
                  <div className="shrink-0 self-center">
                    {prog.isClaimed ? (
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-pixel text-[9px]">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{isRu ? 'ПОЛУЧЕНО' : 'CLAIMED'}</span>
                      </div>
                    ) : prog.canClaim ? (
                      <button
                        onClick={() => handleClaim(ach.id, ach.rewardStardust, ach.rewardXp)}
                        disabled={claimingId === ach.id}
                        className="py-2 px-3.5 bg-gradient-to-r from-[#00f5d4] to-[#00c4a7] text-[#0b071e] font-pixel text-[10px] font-black rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,245,212,0.5)] cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {claimingId === ach.id
                            ? (isRu ? '...' : '...')
                            : (isRu ? 'ЗАБРАТЬ' : 'CLAIM')}
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-gray-400 font-pixel text-[9px]">
                        <Lock className="w-3 h-3 text-gray-500" />
                        <span>{isRu ? 'В ПРОЦЕССЕ' : 'LOCKED'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Bar (if not claimed) */}
                {!prog.isClaimed && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[9px] font-mono text-gray-400">
                      <span>{isRu ? 'Прогресс' : 'Progress'}</span>
                      <span className="text-[#00f5d4] font-bold">
                        {prog.currentValue.toLocaleString()} / {prog.targetValue.toLocaleString()} ({prog.progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${
                          prog.isCompleted ? 'bg-[#00f5d4]' : 'bg-[#9d4edd]'
                        }`}
                        style={{ width: `${prog.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
