import React, { useState, useEffect } from 'react';
import { Calendar, Check, Gift, Clock } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { DailyChest3DIcon, StardustCrystalIcon } from './ui/Icons';
import { audioManager } from '../utils/audio';
import { KokonutModal, KokonutCard, KokonutButton, KokonutBadge } from './ui/kokonut';

interface DailyStreakModalProps {
  profile: PlayerProfile;
  onClaimReward: () => Promise<void> | void;
  onClose: () => void;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  profile,
  onClaimReward,
  onClose,
}) => {
  const t = getTranslation(profile.lang);
  const isRu = profile.lang === 'ru';
  const [isClaiming, setIsClaiming] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];

  const isClaimedToday = Boolean(
    profile.isDailyRewardClaimedToday || (profile.lastDailyClaimDate && profile.lastDailyClaimDate === todayStr)
  );

  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const diff = Math.max(0, nextReset.getTime() - now.getTime());
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeStreak = profile.streakDays || 0;
  const targetDay = isClaimedToday
    ? Math.max(1, Math.min(30, activeStreak))
    : Math.min(30, activeStreak + 1);

  let todayReward = 20 + targetDay * 10;
  if (targetDay % 5 === 0) todayReward += 150;
  if (targetDay === 30) todayReward = 2000;

  const days = Array.from({ length: 30 }, (_, index) => {
    const dayNum = index + 1;
    const isMilestone = dayNum % 5 === 0;
    const isDay30 = dayNum === 30;
    let stardust = 20 + dayNum * 10;
    if (isMilestone) stardust += 150;
    if (isDay30) stardust = 2000;

    const isClaimed = isClaimedToday ? dayNum <= activeStreak : dayNum <= activeStreak && dayNum < targetDay;
    const isCurrentTarget = !isClaimedToday && dayNum === targetDay;
    const isClaimedJustToday = isClaimedToday && dayNum === activeStreak;

    return {
      day: dayNum,
      stardust,
      isClaimed,
      isCurrentTarget,
      isClaimedJustToday,
      isMilestone,
      isDay30,
    };
  });

  const handleClaim = async () => {
    if (isClaimedToday || isClaiming) return;
    setIsClaiming(true);
    try {
      audioManager.playNavConfirm();
      triggerHaptic('success');
      await onClaimReward();
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={isRu ? 'Ежедневные Награды (30 Дней)' : 'Daily Rewards Calendar (30 Days)'}
      icon={<Calendar className="w-5 h-5 text-[#ff007f]" />}
      badge={
        <KokonutBadge variant="pink" size="sm">
          {activeStreak} DAYS STREAK
        </KokonutBadge>
      }
      maxWidth="xl"
    >
      <div className="flex flex-col gap-4">
        {/* Banner Card with Reward Spotlight & Countdown Timer */}
        <KokonutCard variant="glow" hoverEffect={false} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <DailyChest3DIcon size={56} className="animate-bounce" />
            <div className="flex flex-col">
              <span className="font-pixel text-xs text-[#00f5d4]">
                {isClaimedToday
                  ? isRu
                    ? 'СЕГОДНЯШНЯЯ НАГРАДА ПОЛУЧЕНА!'
                    : 'TODAY REWARD CLAIMED!'
                  : isRu
                  ? `НАГРАДА ДНЯ ${targetDay}`
                  : `DAY ${targetDay} REWARD`}
              </span>
              <span className="font-pixel text-lg text-white font-bold flex items-center gap-1.5 mt-0.5">
                <StardustCrystalIcon size={18} color="#ffb703" />
                +{todayReward.toLocaleString()} STARDUST
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {isClaimedToday ? (
              <div className="flex items-center gap-1.5 bg-[#0d0622] px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 text-xs">
                <Clock className="w-4 h-4 text-[#ff007f]" />
                <span className="font-mono">{timeLeft}</span>
              </div>
            ) : (
              <KokonutButton
                variant="glow"
                size="lg"
                isLoading={isClaiming}
                onClick={handleClaim}
                icon={<Gift className="w-5 h-5" />}
              >
                {isRu ? 'ЗАБРАТЬ НАГРАДУ' : 'CLAIM REWARD'}
              </KokonutButton>
            )}
          </div>
        </KokonutCard>

        {/* 30-Day Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[340px] overflow-y-auto pr-1">
          {days.map((item) => (
            <KokonutCard
              key={item.day}
              variant={item.isCurrentTarget ? 'glow' : item.isClaimed ? 'solid' : 'glass'}
              hoverEffect={!item.isClaimed}
              className={`p-2 flex flex-col items-center justify-between text-center gap-1 min-h-[75px] border ${
                item.isCurrentTarget
                  ? 'border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.4)]'
                  : item.isClaimed
                  ? 'border-emerald-500/40 opacity-75'
                  : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-pixel text-[9px] text-gray-400">D{item.day}</span>
                {item.isClaimed && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>

              <div className="my-0.5">
                <StardustCrystalIcon size={16} color={item.isMilestone ? '#ff007f' : '#ffb703'} />
              </div>

              <span className="font-pixel text-[9px] text-white font-bold tabular-nums">
                +{item.stardust}
              </span>
            </KokonutCard>
          ))}
        </div>
      </div>
    </KokonutModal>
  );
};
