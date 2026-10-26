import React, { useRef, useEffect } from 'react';
import { Share2, Sparkles, Zap, Crosshair, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { animate, stagger } from 'animejs';
import { PlayerProfile, LiveEventConfig } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { triggerHaptic } from '../utils/telegram';
import { OrbitRocketIcon, DailyStreakIcon, MotionShipPreview } from './ui/Icons';
import { EventBanner } from './EventBanner';
import { ModalType } from '../store/modalStore';
import { audioManager } from '../utils/audio';
import { KokonutButton, KokonutCard, KokonutBadge } from './ui/kokonut';

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

  const headerRef = useRef<HTMLDivElement | null>(null);
  const shipCardRef = useRef<HTMLDivElement | null>(null);
  const actionStackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Staggered Anime.js entrance for main menu elements
    const targets = [headerRef.current, shipCardRef.current, actionStackRef.current].filter(Boolean);
    if (targets.length > 0) {
      try {
        animate(targets, {
          opacity: [0, 1],
          translateY: [18, 0],
          scale: [0.96, 1],
          duration: 480,
          delay: stagger(110),
          ease: 'outBack(1.5)',
        });
      } catch {}
    }
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between px-3 sm:px-4 py-2 sm:py-3.5 bg-gradient-to-b from-[#050212]/90 via-[#08041d]/85 to-[#04010d]/95 backdrop-blur-md overflow-y-auto max-w-md mx-auto w-full border-x border-[#00f5d4]/15 shadow-[0_0_60px_rgba(0,0,0,0.9)] select-none">
      
      {/* Top Branding & Tactical Space Telemetry */}
      <div ref={headerRef} className="flex flex-col items-center gap-1 text-center w-full shrink-0">
        <KokonutBadge variant="cyan" size="sm" className="shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-ping mr-1" />
          {t.tagline || 'RETRO SPACE FOOTBALL'}
        </KokonutBadge>

        <h1 className="font-pixel text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white via-[#00f5d4] to-white text-glow-cyan font-extrabold tracking-tight drop-shadow-[0_0_15px_rgba(0,245,212,0.6)]">
          {t.appTitle || 'NEON ORBIT'}
        </h1>

        {/* Tactical Coordinates Subtitle */}
        <div className="text-[8px] sm:text-[9px] font-mono-tech text-cyan-400/70 uppercase tracking-widest flex items-center gap-1.5 font-semibold">
          <span>ORBITAL SECTOR 07</span>
          <span className="text-[#ff007f]">•</span>
          <span>SEASON 1 ACTIVE</span>
        </div>

        {/* Live Event Banner */}
        <div className="w-full mt-1">
          <EventBanner
            eventConfig={eventConfig}
            lang={profile.lang}
            onBannerClick={() => {
              audioManager.playModalOpen('seasonPass');
              triggerHaptic('light');
              onOpenModal('seasonPass');
            }}
          />
        </div>
      </div>

      {/* Interactive Cosmic Ship Hangar Deck */}
      <div
        ref={shipCardRef}
        onMouseEnter={() => audioManager.playNavHover()}
        onClick={() => {
          audioManager.playModalOpen('shop');
          triggerHaptic('medium');
          onOpenModal('shop');
        }}
        className="relative flex flex-col items-center cursor-pointer group my-1.5 sm:my-auto active:scale-95 transition-all duration-300"
      >
        {/* Animated Radar Orbit Rings */}
        <div className="absolute inset-0 -m-4 rounded-full border border-cyan-500/20 group-hover:border-cyan-400/50 animate-spin-slow pointer-events-none" />
        <div className="absolute inset-0 -m-7 rounded-full border border-dashed border-magenta-500/20 group-hover:border-magenta-400/40 animate-spin-slow-reverse pointer-events-none" />

        {/* Ship Platform Card using Kokonut Card styling */}
        <KokonutCard
          variant="glow"
          hoverEffect={true}
          className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-2 flex items-center justify-center animate-float overflow-hidden"
        >
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f5d40a_1px,transparent_1px),linear-gradient(to_bottom,#00f5d40a_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
          
          {/* Ambient Ship Glow */}
          <div 
            className="absolute w-20 h-20 rounded-full blur-2xl opacity-50 group-hover:opacity-85 transition-opacity"
            style={{ backgroundColor: currentShip.color || '#00f5d4' }}
          />

          <MotionShipPreview
            shipId={profile.selectedShip}
            color={currentShip.color || "#00f5d4"}
            accentColor={currentShip.accentColor || "#ff007f"}
            size={90}
          />

          {/* Status Overlay Badge */}
          <KokonutBadge variant="cyan" size="sm" className="absolute bottom-1.5 shadow-md">
            {profile.lang === 'ru' ? 'ЭКИПИРОВАН' : 'EQUIPPED'}
          </KokonutBadge>
        </KokonutCard>

        <div className="flex flex-col items-center mt-2">
          <span className="font-pixel text-[11px] sm:text-[12px] text-[#00f5d4] tracking-wider group-hover:text-white transition-colors flex items-center gap-1.5 font-bold text-glow-cyan">
            <Zap className="w-3.5 h-3.5 text-[#ff007f] animate-pulse" />
            {shipName.toUpperCase()}
          </span>
          <span className="font-pixel text-[8px] sm:text-[9px] text-gray-400 group-hover:text-cyan-300 transition-colors mt-0.5 flex items-center gap-1">
            <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
            {profile.lang === 'ru' ? 'СМЕНИТЬ В АНГАРЕ' : 'CUSTOMIZE IN HANGAR'}
          </span>
        </div>
      </div>

      {/* Main Launch Button & Tactical Action Stack */}
      <div ref={actionStackRef} className="w-full max-w-sm flex flex-col gap-2 shrink-0 mb-1">
        {/* Launch Error Alert Banner */}
        {startRoundError && (
          <div className="w-full p-3 bg-gradient-to-r from-red-950/95 via-purple-950/90 to-red-950/95 border border-red-500/80 rounded-2xl text-red-100 text-xs text-center flex flex-col gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-shake backdrop-blur-md">
            <div className="flex items-center justify-center gap-1.5 text-red-300 font-bold">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{startRoundError}</span>
            </div>
            <KokonutButton
              variant="secondary"
              size="sm"
              onClick={() => {
                onClearStartRoundError();
                onStartRound(false, true);
              }}
              className="w-full"
            >
              {profile.lang === 'ru' ? '🎮 ИГРАТЬ В ДЕМО-РЕЖИМЕ (БЕЗ РЕЙТИНГА)' : '🎮 PLAY DEMO MODE (UNRATED)'}
            </KokonutButton>
          </div>
        )}

        {/* PRIMARY LAUNCH BUTTON with Kokonut UI Glow Button */}
        <KokonutButton
          variant="glow"
          size="lg"
          onClick={() => {
            audioManager.playNavAction(1.2);
            onStartRound(false, false);
          }}
          icon={<OrbitRocketIcon size={24} color="#050212" glowColor="#00f5d4" />}
          className="w-full font-pixel py-3.5 sm:py-4 uppercase text-xs sm:text-sm font-extrabold shadow-[0_0_30px_rgba(0,245,212,0.6)]"
        >
          {t.startRound || 'СТАРТ РАУНДА'}
        </KokonutButton>

        {/* SECONDARY ACTION GRID / STACK */}
        <div className="grid grid-cols-2 gap-2">
          {/* Daily Challenge */}
          <KokonutButton
            variant="shimmer"
            size="md"
            onClick={() => {
              audioManager.playNavAction(1.1);
              onStartRound(true, false);
            }}
            icon={<DailyStreakIcon size={16} color="#ff007f" glowColor="#ff007f" />}
          >
            <span className="truncate font-pixel text-[9px] sm:text-[10px]">{t.dailyChallenge || 'ЕЖЕДНЕВНЫЙ ВЫЗОВ'}</span>
          </KokonutButton>

          {/* Demo Mode */}
          <KokonutButton
            variant="glass"
            size="md"
            onClick={() => {
              audioManager.playNavAction(1.0);
              onStartRound(false, true);
            }}
          >
            <span className="truncate font-pixel text-[9px] sm:text-[10px]">{profile.lang === 'ru' ? '🎮 ДЕМО-ТРЕНИРОВКА' : '🎮 DEMO PRACTICE'}</span>
          </KokonutButton>
        </div>

        {/* Daily Quests Hub Button */}
        <KokonutButton
          variant="secondary"
          size="md"
          onClick={() => {
            audioManager.playModalOpen('missions');
            onOpenModal('dailyContent');
          }}
          icon={<Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
          className="w-full"
        >
          <span className="font-pixel text-[9px] sm:text-[10px]">{profile.lang === 'ru' ? 'ЕЖЕДНЕВНЫЕ КВЕСТЫ И НАГРАДЫ' : 'DAILY QUESTS & REWARDS'}</span>
        </KokonutButton>

        {/* Viral Hub & Challenges Button */}
        <KokonutButton
          variant="gradient"
          size="md"
          onClick={() => {
            audioManager.playModalOpen('referrals');
            onOpenModal('viral');
          }}
          icon={<Share2 className="w-3.5 h-3.5 text-white" />}
          className="w-full"
        >
          <span className="font-pixel text-[9px] sm:text-[10px]">{profile.lang === 'ru' ? 'ВИРУСНЫЙ ШТАБ (ЦЕЛИ И ВЫЗОВЫ)' : 'VIRAL HUB & CHALLENGES'}</span>
        </KokonutButton>
      </div>

    </div>
  );
};
