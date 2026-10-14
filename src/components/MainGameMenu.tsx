import React from 'react';
import { Share2, Sparkles, Zap, Crosshair, HelpCircle, ShieldAlert } from 'lucide-react';
import { PlayerProfile, LiveEventConfig } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { OrbitRocketIcon, DailyStreakIcon, MotionShipPreview } from './ui/Icons';
import { EventBanner } from './EventBanner';
import { ModalType } from '../store/modalStore';

interface MainGameMenuProps {
  profile: PlayerProfile;
  eventConfig: LiveEventConfig;
  currentShip: {
    id: string;
    name: string;
    color: string;
    accentColor?: string;
  };
  startRoundError: string | null;
  onClearStartRoundError: () => void;
  onStartRound: (isDaily?: boolean, isDemo?: boolean) => void;
  onOpenModal: (modal: ModalType) => void;
}

export const MainGameMenu: React.FC<MainGameMenuProps> = ({
  profile,
  eventConfig,
  currentShip,
  startRoundError,
  onClearStartRoundError,
  onStartRound,
  onOpenModal,
}) => {
  const t = getTranslation(profile.lang);
  const shipName = currentShip.name || profile.selectedShip;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between px-3 sm:px-4 py-2.5 sm:py-4 bg-gradient-to-b from-[#03010a]/80 via-[#080417]/70 to-[#03010a]/85 backdrop-blur-md overflow-y-auto max-w-sm mx-auto w-full border-x border-[#00f5d4]/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      
      {/* Top Branding & Cosmic Telemetry Banner */}
      <div className="flex flex-col items-center gap-1.5 animate-fade-in text-center w-full shrink-0">
        <div className="flex items-center gap-2 px-3 py-0.5 rounded-full bg-[#9d4edd]/15 border border-[#9d4edd]/40 text-[#00f5d4] text-[9px] sm:text-[10px] font-pixel tracking-widest uppercase shadow-[0_0_12px_rgba(157,78,221,0.25)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-ping" />
          <span>{t.tagline || 'RETRO SPACE ARCADE'}</span>
        </div>

        <h1 className="font-pixel text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white via-[#00f5d4] to-white text-glow-cyan font-bold tracking-tight drop-shadow-[0_0_12px_rgba(0,245,212,0.5)]">
          {t.appTitle || 'NEON ORBIT'}
        </h1>

        {/* Tactical Coordinates Subtitle */}
        <div className="text-[8px] font-mono text-cyan-400/60 uppercase tracking-widest flex items-center gap-1.5">
          <span>SYS-ORBIT :: SECTOR 07</span>
          <span className="text-[#ff007f]">•</span>
          <span>LIVE OPS</span>
        </div>

        {/* Live Event Banner */}
        <div className="w-full mt-1">
          <EventBanner
            eventConfig={eventConfig}
            lang={profile.lang}
            onBannerClick={() => {
              triggerHaptic('light');
              onOpenModal('seasonPass');
            }}
          />
        </div>
      </div>

      {/* Interactive Cosmic Ship Hangar Deck */}
      <div
        onClick={() => {
          triggerHaptic('medium');
          onOpenModal('shop');
        }}
        className="relative flex flex-col items-center cursor-pointer group my-2 sm:my-auto active:scale-95 transition-all duration-200"
      >
        {/* Radar Orbit Rings */}
        <div className="absolute inset-0 -m-4 rounded-full border border-cyan-500/10 group-hover:border-cyan-400/30 animate-spin-slow pointer-events-none" />
        <div className="absolute inset-0 -m-8 rounded-full border border-dashed border-magenta-500/10 group-hover:border-magenta-400/20 pointer-events-none" />

        {/* Ship Platform Card */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-b from-[#160c38]/90 via-[#0d0722]/95 to-[#060312]/95 border-2 border-[#00f5d4]/60 flex items-center justify-center shadow-[0_0_25px_rgba(0,245,212,0.35)] group-hover:shadow-[0_0_40px_rgba(0,245,212,0.7)] group-hover:border-[#00f5d4] transition-all overflow-hidden p-2 backdrop-blur-md">
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f5d40a_1px,transparent_1px),linear-gradient(to_bottom,#00f5d40a_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
          
          {/* Ambient Glow */}
          <div 
            className="absolute w-20 h-20 rounded-full blur-2xl opacity-40 transition-all group-hover:opacity-75"
            style={{ backgroundColor: currentShip.color || '#00f5d4' }}
          />

          <MotionShipPreview
            shipId={profile.selectedShip}
            color={currentShip.color || "#00f5d4"}
            accentColor={currentShip.accentColor || "#ff007f"}
            size={100}
          />

          {/* Status Overlay Badge */}
          <div className="absolute bottom-1 px-2 py-0.5 rounded-md bg-black/70 border border-[#00f5d4]/40 text-[#00f5d4] text-[8px] font-pixel uppercase tracking-widest backdrop-blur-sm">
            {profile.lang === 'ru' ? 'ЭКИПИРОВАН' : 'EQUIPPED'}
          </div>
        </div>

        <div className="flex flex-col items-center mt-2">
          <span className="font-pixel text-[11px] sm:text-[12px] text-[#00f5d4] tracking-wider group-hover:text-white transition-colors flex items-center gap-1 font-bold">
            <Zap className="w-3 h-3 text-[#ff007f] animate-pulse" />
            {shipName.toUpperCase()}
          </span>
          <span className="font-pixel text-[8px] sm:text-[9px] text-gray-400 group-hover:text-cyan-300 transition-colors mt-0.5 flex items-center gap-1">
            <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
            {profile.lang === 'ru' ? 'НАЖМИ ДЛЯ СМЕНЫ В АНГАРЕ' : 'TAP TO CUSTOMIZE IN HANGAR'}
          </span>
        </div>
      </div>

      {/* Main Launch Button & Tactical Action Stack */}
      <div className="w-full max-w-sm flex flex-col gap-2 shrink-0 mb-1">
        {/* Launch Error Alert Banner */}
        {startRoundError && (
          <div className="w-full p-3 bg-gradient-to-r from-red-950/95 via-purple-950/90 to-red-950/95 border border-red-500/80 rounded-2xl text-red-100 text-xs text-center flex flex-col gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-shake backdrop-blur-md">
            <div className="flex items-center justify-center gap-1.5 text-red-300 font-bold">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{startRoundError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onClearStartRoundError();
                onStartRound(false, true);
              }}
              className="py-2 px-3 bg-gradient-to-r from-purple-800 to-indigo-900 border border-purple-400 text-purple-100 font-pixel text-[10px] rounded-xl hover:from-purple-700 hover:to-indigo-800 active:scale-98 transition-all font-bold shadow-lg"
            >
              {profile.lang === 'ru' ? '🎮 ИГРАТЬ В ДЕМО-РЕЖИМЕ (БЕЗ РЕЙТИНГА)' : '🎮 PLAY DEMO MODE (UNRATED)'}
            </button>
          </div>
        )}

        {/* PRIMARY LAUNCH BUTTON */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('heavy');
            onStartRound(false, false);
          }}
          className="relative w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#00f5d4] via-[#38bdf8] to-[#00f5d4] text-[#050212] font-pixel text-xs sm:text-sm rounded-2xl font-black hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(0,245,212,0.65)] border-2 border-[#00f5d4] group overflow-hidden"
        >
          {/* Shimmer Light Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          
          <OrbitRocketIcon size={24} color="#050212" glowColor="#00f5d4" className="group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300" />
          <span className="tracking-wider uppercase font-extrabold">{t.startRound || 'СТАРТ РАУНДА'}</span>
        </button>

        {/* SECONDARY ACTION GRID / STACK */}
        <div className="grid grid-cols-2 gap-2">
          {/* Daily Challenge */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onStartRound(true, false);
            }}
            className="py-2.5 px-2 bg-gradient-to-r from-[#210938] to-[#3a0852] border border-[#ff007f]/60 text-white font-pixel text-[9px] sm:text-[10px] rounded-xl hover:border-[#ff007f] hover:shadow-[0_0_18px_rgba(255,0,127,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(255,0,127,0.25)]"
          >
            <DailyStreakIcon size={16} color="#ff007f" glowColor="#ff007f" />
            <span className="truncate">{t.dailyChallenge || 'ЕЖЕДНЕВНЫЙ ВЫЗОВ'}</span>
          </button>

          {/* Demo Mode */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onStartRound(false, true);
            }}
            className="py-2.5 px-2 bg-gradient-to-r from-[#120b2e] to-[#1c1042] border border-purple-500/40 text-purple-200 font-pixel text-[9px] sm:text-[10px] rounded-xl hover:border-purple-400 hover:bg-purple-950/80 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
          >
            <span className="truncate">{profile.lang === 'ru' ? '🎮 ДЕМО-РЕЖИМ' : '🎮 DEMO PRACTICE'}</span>
          </button>
        </div>

        {/* Daily Quests Hub Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenModal('dailyContent');
          }}
          className="w-full py-2.5 bg-gradient-to-r from-[#071927] to-[#0d2a42] border border-cyan-500/50 text-cyan-300 font-pixel text-[9px] sm:text-[10px] rounded-xl hover:border-cyan-400 hover:bg-[#0d3454] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>{profile.lang === 'ru' ? 'ЕЖЕДНЕВНЫЕ КВЕСТЫ И НАГРАДЫ' : 'DAILY QUESTS & REWARDS'}</span>
        </button>

        {/* Viral Hub & Challenges Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            onOpenModal('viral');
          }}
          className="w-full py-2.5 bg-gradient-to-r from-[#290738] to-[#420a5c] border border-[#ff007f]/50 text-[#ff007f] font-pixel text-[9px] sm:text-[10px] rounded-xl hover:border-[#ff007f] hover:bg-[#520d73] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,0,127,0.25)]"
        >
          <Share2 className="w-3.5 h-3.5 text-[#ff007f]" />
          <span>{profile.lang === 'ru' ? 'ВИРУСНЫЙ ШТАБ (ЦЕЛИ И ВЫЗОВЫ)' : 'VIRAL HUB & CHALLENGES'}</span>
        </button>
      </div>

    </div>
  );
};
