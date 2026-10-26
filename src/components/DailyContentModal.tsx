import React, { useEffect, useState } from 'react';
import { Sparkles, Flame, Shield, Check, Calendar, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { getTranslation, Language } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { StardustCrystalIcon } from './ui/Icons';
import { KokonutModal, KokonutCard, KokonutProgress, KokonutButton, KokonutBadge } from './ui/kokonut';

interface DailyContentModalProps {
  isOpen: boolean;
  lang?: Language;
  onClose: () => void;
}

export const DailyContentModal: React.FC<DailyContentModalProps> = ({ isOpen, lang = 'ru', onClose }) => {
  const [loading, setLoading] = useState(true);
  const [quests, setQuests] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const t = getTranslation(lang);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, sRes] = await Promise.all([
        api.getDailyQuests(),
        api.getDailyStatus(),
      ]);
      if (qRes.success) setQuests(qRes.quests);
      if (sRes.success) setStatus(sRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load daily content');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (questId: string) => {
    try {
      triggerHaptic('medium');
      const res = await api.claimDailyQuest(questId);
      if (res.success) {
        triggerHaptic('success');
        loadData();
      } else {
        triggerHaptic('error');
        setError(res.error);
      }
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message);
    }
  };

  const handleProtectStreak = async () => {
    try {
      triggerHaptic('medium');
      const res = await api.protectStreak();
      if (res.success) {
        triggerHaptic('success');
        loadData();
      } else {
        triggerHaptic('error');
        setError(res.error);
      }
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message);
    }
  };

  return (
    <KokonutModal
      isOpen={isOpen}
      onClose={onClose}
      title={lang === 'ru' ? 'Ежедневный Контент & Квесты' : 'Daily Operations Hub'}
      icon={<Calendar className="w-5 h-5 text-[#00f5d4] animate-pulse" />}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-8 h-8 text-[#00f5d4] animate-spin" />
            <span className="font-pixel text-xs text-[#00f5d4]">
              {lang === 'ru' ? 'СИНХРОНИЗАЦИЯ КВЕСТОВ...' : 'SYNCING OPERATIONS...'}
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
                      {status.streak} {lang === 'ru' ? 'Дней Серии' : 'Days Streak'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-sans">
                      {status.streakProtected
                        ? lang === 'ru'
                          ? 'Защита серии активна!'
                          : 'Streak Protection Active!'
                        : lang === 'ru'
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
                    {lang === 'ru' ? 'ЗАЩИТА СЕРИИ' : 'PROTECT STREAK'}
                  </KokonutButton>
                )}
              </KokonutCard>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500 text-red-200 text-xs text-center font-bold">
                {error}
              </div>
            )}

            {/* Daily Quests List */}
            <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
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
                        {lang === 'ru' ? q.titleRu || q.title : q.title}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-sans truncate">
                        {lang === 'ru' ? q.descriptionRu || q.description : q.description}
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
                        onClick={() => handleClaim(q.id)}
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
    </KokonutModal>
  );
};
