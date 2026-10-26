import React, { useEffect, useState } from 'react';
import { Check, Lock, Sparkles, Trophy, Flame, Shield, Calendar, Loader2 } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { ACHIEVEMENTS_LIST, getAchievementProgress } from '../utils/progression';
import { triggerHaptic } from '../utils/telegram';
import { api } from '../utils/api';
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
  const [activeMainTab, setActiveMainTab] = useState<'achievements' | 'daily'>('achievements');

  // Achievements state
  const [filter, setFilter] = useState<'all' | 'combat' | 'combo' | 'veteran' | 'streak'>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Daily Quests state
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [quests, setQuests] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [dailyError, setDailyError] = useState<string | null>(null);

  useEffect(() => {
    if (activeMainTab === 'daily') {
      loadDailyData();
    }
  }, [activeMainTab]);

  const loadDailyData = async () => {
    setLoadingDaily(true);
    setDailyError(null);
    try {
      const [qRes, sRes] = await Promise.all([
        api.getDailyQuests(),
        api.getDailyStatus(),
      ]);
      if (qRes && qRes.success) setQuests(qRes.quests || []);
      if (sRes && sRes.success) setStatus(sRes);
    } catch (err: any) {
      setDailyError(err.message || 'Failed to load daily content');
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleClaimDaily = async (questId: string) => {
    try {
      triggerHaptic('medium');
      const res = await api.claimDailyQuest(questId);
      if (res && res.success) {
        triggerHaptic('success');
        loadDailyData();
      } else {
        triggerHaptic('error');
        setDailyError(res?.error || 'Claim failed');
      }
    } catch (err: any) {
      triggerHaptic('error');
      setDailyError(err.message);
    }
  };

  const handleProtectStreak = async () => {
    try {
      triggerHaptic('medium');
      const res = await api.protectStreak();
      if (res && res.success) {
        triggerHaptic('success');
        loadDailyData();
      } else {
        triggerHaptic('error');
        setDailyError(res?.error || 'Protection failed');
      }
    } catch (err: any) {
      triggerHaptic('error');
      setDailyError(err.message);
    }
  };

  const filteredAchievements = ACHIEVEMENTS_LIST.filter((ach) =>
    filter === 'all' ? true : ach.category === filter
  );

  const totalUnlockedCount = ACHIEVEMENTS_LIST.filter((ach) =>
    profile.unlockedAchievements?.includes(ach.id)
  ).length;

  const handleClaimAchievementClick = async (achId: string, dust: number, xp: number) => {
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
      title={isRu ? 'Центр Наград и Квестов' : 'Operations & Rewards Hub'}
      icon={<Trophy className="w-5 h-5 text-[#ffb703] animate-bounce" />}
      badge={
        <KokonutBadge variant="cyan" size="sm">
          {totalUnlockedCount} / {ACHIEVEMENTS_LIST.length}
        </KokonutBadge>
      }
      subtitle={
        isRu
          ? 'Пожизненные достижения и ежедневные оперативные квесты'
          : 'Lifetime milestones and daily operational quests'
      }
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3.5">
        {/* Main Hub Section Switcher */}
        <KokonutTabs
          tabs={[
            { id: 'achievements', label: isRu ? '🏆 ДОСТИЖЕНИЯ' : '🏆 ACHIEVEMENTS' },
            { id: 'daily', label: isRu ? '⚡ ЕЖЕДНЕВНЫЕ КВЕСТЫ' : '⚡ DAILY QUESTS' },
          ]}
          activeTab={activeMainTab}
          onChange={(tab) => {
            triggerHaptic('selection');
            setActiveMainTab(tab as 'achievements' | 'daily');
          }}
          layoutId="mainHubSwitcherTabs"
        />

        {activeMainTab === 'achievements' ? (
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
            <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
              {filteredAchievements.map((ach) => {
                const isUnlocked = profile.unlockedAchievements?.includes(ach.id);
                const isClaimed = profile.claimedAchievements?.includes(ach.id);
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
                          onClick={() => handleClaimAchievementClick(ach.id, ach.rewardStardust, ach.rewardXp)}
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
        ) : (
          <div className="flex flex-col gap-3">
            {loadingDaily ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                <Loader2 className="w-8 h-8 text-[#00f5d4] animate-spin" />
                <span className="font-pixel text-xs text-[#00f5d4]">
                  {isRu ? 'СИНХРОНИЗАЦИЯ КВЕСТОВ...' : 'SYNCING OPERATIONS...'}
                </span>
              </div>
            ) : (
              <>
                {/* Status Banner */}
                {status && (
                  <KokonutCard variant="glow" hoverEffect={false} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Flame className="w-6 h-6 text-[#ff007f] animate-pulse" />
                      <div className="flex flex-col">
                        <span className="font-pixel text-xs text-white font-bold">
                          {status.streak} {isRu ? 'Дней Серии' : 'Days Streak'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-sans">
                          {status.streakProtected
                            ? isRu
                              ? 'Защита серии активна!'
                              : 'Streak Protection Active!'
                            : isRu
                            ? 'Выполняйте задания каждый день'
                            : 'Complete operations daily'}
                        </span>
                      </div>
                    </div>

                    {!status.streakProtected && status.canProtect && (
                      <KokonutButton
                        variant="shimmer"
                        size="sm"
                        onClick={handleProtectStreak}
                        icon={<Shield className="w-3.5 h-3.5" />}
                      >
                        {isRu ? 'ЗАЩИТА СЕРИИ' : 'PROTECT STREAK'}
                      </KokonutButton>
                    )}
                  </KokonutCard>
                )}

                {/* Error Message */}
                {dailyError && (
                  <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500 text-red-200 text-xs text-center font-bold">
                    {dailyError}
                  </div>
                )}

                {/* Daily Quests List */}
                <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {quests.map((q) => (
                    <KokonutCard
                      key={q.id}
                      variant={q.completed && !q.claimed ? 'glow' : 'glass'}
                      hoverEffect={!q.claimed}
                      className="p-3.5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col min-w-0 pr-2">
                          <h4 className="font-pixel text-xs text-white font-bold truncate">
                            {isRu ? q.titleRu || q.title : q.title}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-sans truncate">
                            {isRu ? q.descriptionRu || q.description : q.description}
                          </p>
                        </div>

                        {q.claimed ? (
                          <KokonutBadge variant="glass" size="md" icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}>
                            CLAIMED
                          </KokonutBadge>
                        ) : q.completed ? (
                          <KokonutButton
                            variant="glow"
                            size="sm"
                            onClick={() => handleClaimDaily(q.id)}
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                          >
                            CLAIM
                          </KokonutButton>
                        ) : (
                          <KokonutBadge variant="gold" size="md" icon={<StardustCrystalIcon size={12} />}>
                            +{q.rewardStardust}
                          </KokonutBadge>
                        )}
                      </div>

                      <KokonutProgress value={q.progress || 0} max={q.target || 1} size="sm" />
                    </KokonutCard>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </KokonutModal>
  );
};
