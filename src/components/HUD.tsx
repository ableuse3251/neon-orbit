import React from 'react';
import { Pause, Play, Volume2, VolumeX, Shield, Zap, Target, Flame, Sparkles } from 'lucide-react';
import { PowerupType } from '../types/game';
import { getTranslation, Language } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { ComboMeter } from './ComboMeter';

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
  const isTimeCritical = timeLeft <= 10;

  return (
    <div className="absolute inset-x-0 top-0 p-2.5 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pointer-events-none flex flex-col gap-2 z-20 font-mono-tech select-none">
      {/* Top Telemetry & Score Bar */}
      <div className="flex items-center justify-between bg-[#0b071e]/85 border border-[#00f5d4]/40 rounded-2xl p-2.5 sm:p-3 backdrop-blur-xl pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] relative overflow-hidden">
        {/* Subtle background glow element based on multiplier */}
        <div 
          className="absolute -inset-1 opacity-20 blur-xl transition-all duration-500 pointer-events-none"
          style={{
            background: multiplier >= 5 
              ? 'radial-gradient(circle, #00f5d4 0%, transparent 70%)' 
              : multiplier >= 3 
              ? 'radial-gradient(circle, #ff007f 0%, transparent 70%)'
              : 'radial-gradient(circle, #7b2cbf 0%, transparent 70%)'
          }}
        />

        {/* Score Column */}
        <div className="flex flex-col min-w-0 z-10">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-ping" />
            <span className="text-[9px] sm:text-[10px] font-pixel text-[#9d4edd] tracking-widest uppercase">
              {t.score}
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-pixel font-black text-white text-glow-cyan tabular-nums tracking-wider truncate">
            {score.toLocaleString()}
          </span>
        </div>

        {/* Multiplier & Combo Badge */}
        <div className="flex flex-col items-center z-10">
          <div
            className={`px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all duration-300 shadow-md ${
              multiplier >= 5
                ? 'bg-gradient-to-r from-[#00f5d4] via-[#7000ff] to-[#ff007f] text-black font-black text-glow-cyan shadow-[0_0_20px_rgba(0,245,212,0.8)] animate-pulse scale-105'
                : multiplier >= 3
                ? 'bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] text-white font-bold shadow-[0_0_12px_rgba(255,0,127,0.5)]'
                : multiplier >= 2
                ? 'bg-gradient-to-r from-[#ffb703] to-[#fb8500] text-black font-bold shadow-[0_0_10px_rgba(255,183,3,0.4)]'
                : 'bg-[#180e38] border border-[#9d4edd]/30 text-gray-300'
            }`}
          >
            {multiplier >= 5 ? (
              <Sparkles className="w-4 h-4 text-black animate-spin" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
            <span className="font-pixel text-xs tracking-wider uppercase">
              {multiplier >= 5 ? `${t.hypermode} x5` : `x${multiplier}`}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Flame className="w-3 h-3 text-[#ff007f]" />
            <span className="text-[10px] font-mono-tech text-gray-300 tracking-wide">
              {t.combo}: <strong className="text-[#00f5d4] font-bold">{combo}</strong>
            </span>
          </div>
        </div>

        {/* Tactical Quick Controls */}
        <div className="flex items-center gap-2 z-10">
          <button
            onClick={() => {
              triggerHaptic('light');
              onSoundToggle();
            }}
            className="p-2 sm:p-2.5 rounded-xl bg-[#180e38]/80 border border-[#9d4edd]/40 text-gray-200 hover:text-white hover:border-[#00f5d4] active:scale-95 transition-all shadow-inner"
            title={t.soundFx}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-[#00f5d4]" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          </button>
          <button
            onClick={() => {
              triggerHaptic('medium');
              onPauseToggle();
            }}
            className="p-2 sm:p-2.5 rounded-xl bg-[#180e38]/80 border border-[#9d4edd]/40 text-gray-200 hover:text-white hover:border-[#00f5d4] active:scale-95 transition-all shadow-inner"
            title={t.pause}
          >
            {isPaused ? <Play className="w-4 h-4 text-[#00f5d4] fill-[#00f5d4]" /> : <Pause className="w-4 h-4 text-[#ff007f]" />}
          </button>
        </div>
      </div>

      {/* Visual Animated Combo Meter reflecting current multiplier level */}
      <ComboMeter
        combo={combo}
        multiplier={multiplier}
        lang={lang}
      />

      {/* Target Ghost Score Badge for Challenge / Duel Mode */}
      {targetGhostScore && targetGhostScore > 0 && (
        <div className="self-center bg-[#150a2e]/90 border border-[#ffb703]/70 px-4 py-1.5 rounded-full flex items-center gap-2 text-xs font-pixel text-[#ffb703] shadow-[0_0_15px_rgba(255,183,3,0.35)] backdrop-blur-md animate-fade-in pointer-events-auto">
          <Target className="w-3.5 h-3.5 text-[#ffb703] animate-pulse" />
          <span className="tracking-wider">TARGET TO BEAT: {targetGhostScore.toLocaleString()} PTS</span>
          {score > targetGhostScore && (
            <span className="bg-[#00f5d4] text-black px-1.5 py-0.5 rounded text-[9px] font-black animate-bounce">
              VICTORY!
            </span>
          )}
        </div>
      )}

      {/* Countdown Progress & Energy Bar */}
      <div className="w-full bg-[#0b071e]/85 border border-[#9d4edd]/30 rounded-xl p-2 flex items-center gap-3 backdrop-blur-md pointer-events-auto shadow-md">
        <div className="flex-1 h-3.5 bg-[#120a2e] rounded-lg overflow-hidden border border-[#9d4edd]/30 p-0.5 relative">
          <div
            className={`h-full rounded-md transition-all duration-300 relative ${
              isTimeCritical
                ? 'bg-gradient-to-r from-[#ff0054] to-[#ff007f] shadow-[0_0_12px_#ff0054] animate-pulse'
                : timeLeft <= 20
                ? 'bg-gradient-to-r from-[#ffb703] to-[#fb8500] shadow-[0_0_10px_#ffb703]'
                : 'bg-gradient-to-r from-[#00f5d4] to-[#00b4d8] shadow-[0_0_10px_#00f5d4]'
            }`}
            style={{ width: `${timePercent}%` }}
          >
            {/* Animated bar shine effect */}
            <div className="absolute inset-0 bg-white/20 animate-shimmer" />
          </div>
        </div>
        <div className={`font-pixel text-xs font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-md ${
          isTimeCritical ? 'bg-[#ff0054]/20 border border-[#ff0054] text-[#ff0054] animate-bounce' : 'text-white'
        }`}>
          {timeLeft}s
        </div>
      </div>

      {/* Active Powerups Dock */}
      {activePowerups.length > 0 && (
        <div className="flex items-center gap-2 self-center mt-0.5 pointer-events-auto">
          {activePowerups.includes('freeze') && (
            <div className="px-3 py-1 rounded-full bg-[#00f5d4]/20 border border-[#00f5d4] text-[#00f5d4] text-[10px] font-pixel flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,245,212,0.4)] animate-pulse">
              <span className="text-xs">❄️</span>
              <span className="tracking-wider uppercase">{t.freezeActive}</span>
            </div>
          )}
          {activePowerups.includes('shield') && (
            <div className="px-3 py-1 rounded-full bg-[#ffb703]/20 border border-[#ffb703] text-[#ffb703] text-[10px] font-pixel flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,183,3,0.4)]">
              <Shield className="w-3.5 h-3.5 fill-current" />
              <span className="tracking-wider uppercase">{t.shieldActive}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
