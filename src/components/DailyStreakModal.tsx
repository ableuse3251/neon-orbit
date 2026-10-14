import React, { useState, useEffect } from 'react';
import { X, Calendar, Check, Gift, Clock, ShieldCheck } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { DailyChest3DIcon, DailyStreakIcon, StardustCrystalIcon } from './ui/Icons';

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
    try {      triggerHaptic('success');
      await onClaimReward();
    } finally {      setIsClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e]/95 border-2 border-[#9d4edd] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(157,78,221,0.35)] flex flex-col gap-3.5 text-white max-h-[94vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#ff007f]/20 border border-[#ff007f]/40">
              <DailyStreakIcon size={20} />
            </div>
            <div>
              <h2 className="font-pixel text-xs text-[#00f5d4] uppercase tracking-wider">
                {isRu ? 'Календарь Наград (1–30 Дней)' : '30-Day Rewards Calendar'}
              </h2>
              <span className="text-[10px] text-gray-400">
                {isRu ? 'Сброс в 00:00 UTC каждый день' : 'Resets daily at 00:00 UTC'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#210b42] text-gray-400 hover:text-white border border-[#9d4edd]/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="bg-[#0b071e] border border-[#9d4edd]/40 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-pixel">
              {t.currentStreak}:
            </span>
            <span className="font-pixel text-base sm:text-lg text-[#ffb703] font-bold flex items-center gap-1.5 mt-0.5">
              <DailyStreakIcon size={18} /> {activeStreak} {t.daysInRow}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="px-2.5 py-1 rounded-full bg-[#210b42] border border-[#00f5d4]/60 text-[#00f5d4] font-pixel text-[10px] flex items-center gap-1.5">
              <StardustCrystalIcon size={12} />
              <span>{isRu ? 'Награды за вход' : 'Daily Login'}</span>
            </div>
            {profile.hasStreakInsurance && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <ShieldCheck className="w-3 h-3" />
                <span>{isRu ? 'Защита активна' : 'Shield Active'}</span>
              </div>
            )}
          </div>
        </div>

        {/* 30-Day Rewards Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-5 gap-2 pr-1 max-h-[46vh] scrollbar-thin scrollbar-thumb-[#9d4edd]/40">
          {days.map((item) => (
            <div
              key={item.day}
              className={`relative p-2 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
                item.isClaimed
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                  : item.isCurrentTarget
                  ? 'bg-[#00f5d4]/20 border-2 border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.4)] animate-pulse'
                  : item.isDay30
                  ? 'bg-[#ff007f]/20 border border-[#ff007f]/60 shadow-[0_0_10px_rgba(255,0,127,0.3)]'
                  : item.isMilestone
                  ? 'bg-[#ffb703]/15 border border-[#ffb703]/50'
                  : 'bg-[#210b42]/80 border-[#9d4edd]/25 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`font-pixel text-[8px] ${item.isCurrentTarget ? 'text-[#00f5d4] font-bold' : 'text-gray-400'}`}>
                  D{item.day}
                </span>
                {item.isMilestone && !item.isDay30 && (
                  <span className="text-[7px] text-[#ffb703] font-mono uppercase">x5</span>
                )}
                {item.isDay30 && (
                  <span className="text-[7px] text-[#ff007f] font-mono uppercase">MAX</span>
                )}
              </div>

              {/* Status Icon */}
              <div className="my-1.5 flex items-center justify-center">
                {item.isClaimed ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />
                  </div>
                ) : item.isDay30 ? (
                  <DailyChest3DIcon size={24} />
                ) : item.isMilestone ? (
                  <Gift className="w-4 h-4 text-[#ffb703]" />
                ) : (
                  <StardustCrystalIcon size={14} color={item.isCurrentTarget ? '#00f5d4' : '#ffb703'} />
                )}
              </div>

              <span className={`font-pixel text-[9px] font-bold ${item.isClaimed ? 'text-emerald-300' : item.isCurrentTarget ? 'text-[#00f5d4]' : 'text-[#ffb703]'}`}>
                +{item.stardust}
              </span>
            </div>
          ))}
        </div>

        {/* Action Button & Countdown Area */}
        <div className="pt-2 border-t border-[#9d4edd]/30 flex flex-col gap-2">
          {isClaimedToday ? (
            <div className="space-y-2">
              <button
                disabled={true}
                className="w-full py-3 bg-slate-900/90 border border-emerald-500/40 text-emerald-400 font-pixel text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              >
                <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                <span>{isRu ? '✓ НАГРАДА НА СЕГОДНЯ ПОЛУЧЕНА' : '✓ REWARD CLAIMED TODAY'}</span>
              </button>
              <div className="bg-[#0b071e]/80 border border-white/10 rounded-xl p-2 text-center flex items-center justify-center gap-2 text-xs font-mono">
                <Clock className="w-3.5 h-3.5 text-[#ffb703]" />
                <span className="text-gray-300">
                  {isRu ? 'Следующая награда через:' : 'Next reward in:'}
                </span>
                <span className="font-bold text-[#00f5d4] font-mono tracking-wider">
                  {timeLeft || '00:00:00'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <button
                onClick={handleClaim}
                disabled={isClaiming || isClaimedToday}
                className={`w-full py-3.5 bg-gradient-to-r from-[#00f5d4] via-[#00f5d4] to-[#00c4a7] text-[#0b071e] font-pixel text-xs rounded-xl font-black hover:brightness-110 shadow-[0_0_20px_rgba(0,245,212,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  isClaiming ? 'opacity-60 cursor-wait' : 'cursor-pointer'
                }`}
              >
                <Gift className="w-4 h-4 text-[#0b071e]" />
                <span>
                  {isClaiming
                    ? (isRu ? 'СОХРАНЕНИЕ...' : 'SAVING...')
                    : (isRu ? `ЗАБРАТЬ НАГРАДУ (+${todayReward} 🌟)` : `CLAIM TODAY'S REWARD (+${todayReward} 🌟)`)}
                </span>
              </button>
              <div className="text-center text-[10px] text-gray-400 font-mono">
                {isRu ? `День ${targetDay} из 30 • Серия продолжается!` : `Day ${targetDay} of 30 • Streak ongoing!`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
