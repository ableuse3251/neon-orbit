import React, { useState, useEffect } from 'react';
import { Zap, Flame, Sparkles, Clock, ShieldAlert } from 'lucide-react';
import { LiveEventConfig, Language } from '../types/game';

interface EventBannerProps {
  eventConfig: LiveEventConfig;
  lang?: Language;
  onBannerClick?: () => void;
}

export const EventBanner: React.FC<EventBannerProps> = ({
  eventConfig,
  lang = 'en',
  onBannerClick,
}) => {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('00:00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const endMs = new Date(eventConfig.endDateISO).getTime();
      const nowMs = Date.now();
      const diffMs = Math.max(0, endMs - nowMs);

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeftStr(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [eventConfig.endDateISO]);

  const title = lang === 'ru' ? eventConfig.titleRu : eventConfig.titleEn;
  const subtitle = lang === 'ru' ? eventConfig.bannerSubtitleRu : eventConfig.bannerSubtitleEn;

  return (
    <div
      onClick={onBannerClick}
      className={`relative w-full max-w-sm rounded-xl p-3 border-2 transition-all cursor-pointer select-none font-mono-tech overflow-hidden ${
        eventConfig.isGoldenHourActive
          ? 'bg-[#210b42]/90 border-[#ffb703] shadow-[0_0_20px_#ffb703] animate-pulse'
          : 'bg-[#120a2e]/90 border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.3)]'
      }`}
    >
      {/* Background Animated Gradient Pulse */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${eventConfig.bannerColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
              eventConfig.isGoldenHourActive
                ? 'bg-[#ffb703]/20 border-[#ffb703] text-[#ffb703]'
                : 'bg-[#00f5d4]/20 border-[#00f5d4] text-[#00f5d4]'
            }`}
          >
            {eventConfig.isGoldenHourActive ? (
              <Zap className="w-5 h-5 fill-current animate-bounce" />
            ) : (
              <Flame className="w-5 h-5" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-pixel text-xs text-white uppercase">{title}</span>
              <span className="px-1.5 py-0.5 rounded bg-[#210b42] border border-[#ff007f] text-[#ff007f] text-[8px] font-pixel">
                {eventConfig.badgeLabel}
              </span>
            </div>
            <span className="text-[10px] text-gray-300 font-mono-tech mt-0.5">
              {subtitle}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-[8px] font-pixel text-gray-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> ENDS IN
          </span>
          <span className="font-pixel text-xs text-[#00f5d4] tabular-nums font-bold mt-0.5">
            {timeLeftStr}
          </span>
        </div>
      </div>
    </div>
  );
};
