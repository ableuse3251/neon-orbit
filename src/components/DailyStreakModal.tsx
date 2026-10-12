import React from 'react';
import { X, Calendar, Check, Gift, Sparkles } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

interface DailyStreakModalProps {
  profile: PlayerProfile;
  onClaimReward: () => void;
  onClose: () => void;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  profile,
  onClaimReward,
  onClose,
}) => {
  const t = getTranslation(profile.lang);

  // Generate 30 days reward layout
  const days = Array.from({ length: 30 }, (_, index) => {
    const dayNum = index + 1;
    const isMilestone = dayNum % 5 === 0;
    const isDay30 = dayNum === 30;

    let stardust = 20 + dayNum * 10;
    if (isMilestone) stardust += 150;
    if (isDay30) stardust = 2000;

    return {
      day: dayNum,
      stardust,
      claimed: profile.streakDays >= dayNum,
      isMilestone,
      isDay30,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffb703]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {profile.lang === 'ru' ? 'Календарь Наград (1–30 Дней)' : '30-Day Rewards Calendar'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="bg-[#0b071e] border border-[#9d4edd]/30 rounded-lg p-3 text-center flex items-center justify-between">
          <div className="flex flex-col text-left">
            <span className="text-xs text-gray-400">{t.currentStreak}:</span>
            <span className="font-pixel text-xl text-[#ffb703] text-glow-amber font-bold">
              {profile.streakDays} {t.daysInRow}
            </span>
          </div>
          <div className="px-3 py-1 rounded-full bg-[#210b42] border border-[#00f5d4] text-[#00f5d4] font-pixel text-xs flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>🌟 Stardust</span>
          </div>
        </div>

        {/* 30-Day Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-5 gap-2 pr-1 max-h-[50vh]">
          {days.map((item) => (
            <div
              key={item.day}
              className={`p-2 rounded-lg border flex flex-col items-center justify-between text-center transition-all ${
                item.claimed
                  ? 'bg-[#00f5d4]/10 border-[#00f5d4]'
                  : item.isDay30
                  ? 'bg-[#ff007f]/20 border-[#ff007f] shadow-[0_0_10px_#ff007f]'
                  : item.isMilestone
                  ? 'bg-[#ffb703]/20 border-[#ffb703]'
                  : 'bg-[#210b42] border-[#9d4edd]/30'
              }`}
            >
              <span className="font-pixel text-[8px] text-gray-300">D{item.day}</span>
              {item.claimed ? (
                <Check className="w-3.5 h-3.5 text-[#00f5d4] my-1" />
              ) : item.isDay30 ? (
                <span className="text-base my-0.5">👑</span>
              ) : item.isMilestone ? (
                <Gift className="w-3.5 h-3.5 text-[#ffb703] my-1" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-gray-400 my-1" />
              )}
              <span className="font-pixel text-[9px] text-[#ffb703] font-bold">
                +{item.stardust}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            triggerHaptic('success');
            onClaimReward();
          }}
          className="w-full py-3 bg-[#00f5d4] text-[#0b071e] font-pixel text-xs rounded-lg font-bold hover:bg-[#00f5d4]/90 shadow-[0_0_12px_#00f5d4]"
        >
          {t.claimReward}
        </button>
      </div>
    </div>
  );
};
