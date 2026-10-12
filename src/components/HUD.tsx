import React from 'react';
import { Pause, Play, Volume2, VolumeX, Shield, Zap, Target } from 'lucide-react';
import { PowerupType } from '../types/game';
import { getTranslation, Language } from '../utils/i18n';

interface HUDProps {
  score: number;
  combo: number;
  multiplier: number;
  timeLeft: number;
  activePowerups: PowerupType[];
  isPaused: boolean;
  soundEnabled: boolean;
  targetGhostScore?: number;
  lang?: Language;
  onPauseToggle: () => void;
  onSoundToggle: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  combo,
  multiplier,
  timeLeft,
  activePowerups,
  isPaused,
  soundEnabled,
  targetGhostScore,
  lang = 'en',
  onPauseToggle,
  onSoundToggle,
}) => {
  const t = getTranslation(lang);
  const timePercent = Math.max(0, Math.min(100, (timeLeft / 45) * 100));

  return (
    <div className="absolute inset-x-0 top-0 p-2 sm:p-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))] pointer-events-none flex flex-col gap-1.5 sm:gap-2 z-20 font-mono-tech">
      <div className="flex items-center justify-between bg-[#120a2e]/90 border border-[#9d4edd]/50 rounded-xl p-2 sm:p-2.5 backdrop-blur-md pointer-events-auto border-glow-cyan shadow-lg">
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] sm:text-[10px] font-pixel text-[#9d4edd] tracking-widest uppercase">
            {t.score}
          </span>
          <span className="text-lg sm:text-2xl font-pixel font-bold text-white text-glow-cyan tabular-nums tracking-wider truncate">
            {score.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div
            className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-all duration-200 ${
              multiplier >= 5
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold text-glow-cyan shadow-[0_0_15px_#00f5d4] animate-pulse'
                : multiplier >= 3
                ? 'bg-[#ff007f] text-white font-bold'
                : multiplier >= 2
                ? 'bg-[#ffb703] text-black font-bold'
                : 'bg-[#210b42] text-gray-300'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span className="font-pixel text-xs tracking-wide">
              {multiplier >= 5 ? `${t.hypermode} x5` : `x${multiplier}`}
            </span>
          </div>
          <span className="text-[9px] font-mono-tech text-gray-400 mt-0.5">
            {t.combo}: {combo}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSoundToggle}
            className="p-2 rounded-md bg-[#210b42] border border-[#9d4edd]/40 text-gray-200 hover:text-white hover:border-[#00f5d4] transition-colors"
            title={t.soundFx}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onPauseToggle}
            className="p-2 rounded-md bg-[#210b42] border border-[#9d4edd]/40 text-gray-200 hover:text-white hover:border-[#00f5d4] transition-colors"
            title={t.pause}
          >
            {isPaused ? <Play className="w-4 h-4 text-[#00f5d4]" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Target Ghost Score Badge for Challenge Mode */}
      {targetGhostScore && targetGhostScore > 0 && (
        <div className="self-center bg-[#210b42]/90 border border-[#ffb703] px-3 py-1 rounded-full flex items-center gap-2 text-xs font-pixel text-[#ffb703] shadow-[0_0_10px_rgba(255,183,3,0.3)]">
          <Target className="w-3.5 h-3.5 text-[#ffb703]" />
          <span>TARGET TO BEAT: {targetGhostScore.toLocaleString()} PTS</span>
          {score > targetGhostScore && (
            <span className="text-[#00f5d4] font-bold animate-bounce">BEATEN! 🎉</span>
          )}
        </div>
      )}

      <div className="w-full bg-[#120a2e]/90 border border-[#9d4edd]/30 rounded-md p-1.5 flex items-center gap-3 backdrop-blur-sm pointer-events-auto">
        <div className="flex-1 h-3 bg-[#0b071e] rounded-sm overflow-hidden border border-[#9d4edd]/20">
          <div
            className={`h-full transition-all duration-300 ${
              timeLeft <= 10
                ? 'bg-[#ff0054] shadow-[0_0_10px_#ff0054]'
                : timeLeft <= 20
                ? 'bg-[#ffb703]'
                : 'bg-[#00f5d4] shadow-[0_0_10px_#00f5d4]'
            }`}
            style={{ width: `${timePercent}%` }}
          />
        </div>
        <span className="font-pixel text-xs text-white tabular-nums shrink-0">
          {timeLeft}s
        </span>
      </div>

      {activePowerups.length > 0 && (
        <div className="flex items-center gap-2 self-center mt-1">
          {activePowerups.includes('freeze') && (
            <div className="px-2.5 py-1 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4] text-[#00f5d4] text-[10px] font-pixel flex items-center gap-1 animate-pulse">
              <span>❄️</span>
              <span>{t.freezeActive}</span>
            </div>
          )}
          {activePowerups.includes('shield') && (
            <div className="px-2.5 py-1 rounded-full bg-[#ffb703]/20 border border-[#ffb703] text-[#ffb703] text-[10px] font-pixel flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>{t.shieldActive}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
