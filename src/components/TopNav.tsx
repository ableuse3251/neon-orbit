import React, { useState, useEffect, useRef } from 'react';
import { Settings, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { animate } from 'animejs';
import { PlayerProfile } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { getLevelFromXp } from '../utils/progression';
import { StardustCrystalIcon, StarXtrIcon } from './ui/Icons';
import { triggerHaptic } from '../utils/telegram';
import { audioManager } from '../utils/audio';
import { KokonutButton, KokonutBadge } from './ui/kokonut';

interface TopNavProps {
  profile: PlayerProfile;
  onOpenProfile: () => void;
  onOpenShop: () => void;
  onOpenStarsShop: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel?: () => void;
  onOpenLeaderboard?: () => void;
  onOpenAchievements?: () => void;
  onOpenStreak?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  profile,
  onOpenProfile,
  onOpenShop,
  onOpenStarsShop,
  onOpenSettings,
  onOpenAdminPanel,
}) => {
  const t = getTranslation(profile.lang);
  const lvlInfo = getLevelFromXp(profile.xp);

  const localizedRankTitle =
    profile.rankTitle === 'Fleet Admiral'
      ? t.rankAdmiral
      : profile.rankTitle === 'Commander'
      ? t.rankCommander
      : t.rankPilot;

  // Anime.js dynamic rolling counter for Stardust currency
  const [displayedStardust, setDisplayedStardust] = useState(profile.stardust);
  const stardustRef = useRef(profile.stardust);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplayedStardust(profile.stardust);
      return;
    }
    if (profile.stardust === stardustRef.current) return;
    const startVal = stardustRef.current;
    const targetVal = profile.stardust;
    stardustRef.current = targetVal;

    const counter = { val: startVal };
    try {
      animate(counter, {
        val: targetVal,
        duration: 450,
        ease: 'outExpo',
        onUpdate: () => {
          setDisplayedStardust(Math.round(counter.val));
        },
      });
    } catch {
      setDisplayedStardust(targetVal);
    }
  }, [profile.stardust]);

  return (
    <header className="relative w-full bg-[#080417]/85 border-b border-[#00f5d4]/20 px-3 sm:px-5 py-2.5 flex items-center justify-between backdrop-blur-2xl z-30 font-mono-tech select-none shrink-0 pt-[max(0.6rem,env(safe-area-inset-top,0px))] shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
      {/* Top Subtle Neon Beam Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f5d4]/60 to-transparent pointer-events-none" />

      {/* Pilot Avatar & Level (Click opens Flight Logbook Profile) */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onMouseEnter={() => audioManager.playNavHover()}
        onClick={() => {
          audioManager.playModalOpen('registration');
          triggerHaptic('light');
          onOpenProfile();
        }}
        className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-2xl bg-[#130a2e]/60 hover:bg-[#1b0d3f]/80 transition-all border border-white/5 hover:border-[#00f5d4]/40 text-left min-w-0 group shadow-sm"
      >
        <div className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-[#14082b] border-2 border-[#00f5d4]/80 flex items-center justify-center shadow-[0_0_15px_rgba(0,245,212,0.3)] group-hover:shadow-[0_0_22px_rgba(0,245,212,0.6)] group-hover:border-[#00f5d4] transition-all overflow-hidden">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <span className="font-pixel text-xs sm:text-sm text-[#00f5d4] font-bold">
              {lvlInfo.level}
            </span>
          )}

          <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[#ff007f] to-[#ff00a0] text-white text-[7px] font-pixel px-1.5 py-0.2 rounded-full shadow-[0_0_8px_#ff007f] border border-black/60 font-bold">
            LVL {lvlInfo.level}
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="font-pixel text-[11px] sm:text-xs text-white flex items-center gap-1.5 truncate max-w-[120px] sm:max-w-[180px]">
            <span className="truncate group-hover:text-[#00f5d4] transition-colors tracking-tight">
              {profile.username || profile.firstName}
            </span>
            <KokonutBadge variant="gold" size="sm" className="hidden xs:inline-flex">
              {localizedRankTitle}
            </KokonutBadge>
            {profile.isDemo && (
              <KokonutBadge variant="cyan" size="sm" className="animate-pulse">
                DEMO
              </KokonutBadge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] text-gray-400">
            <span className="text-gray-400">{t.record}:</span>
            <strong className="text-[#00f5d4] font-pixel tabular-nums truncate tracking-wider">
              {profile.highScore.toLocaleString()}
            </strong>
          </div>
        </div>
      </motion.button>

      {/* Kokonut UI Action Buttons & Currency */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Admin Live Ops Access Button (if authorized) */}
        {profile.isAdmin && onOpenAdminPanel && (
          <KokonutButton
            variant="danger"
            size="icon"
            onClick={() => {
              audioManager.playModalOpen('admin');
              onOpenAdminPanel();
            }}
            title="Live Ops Admin Panel"
            aria-label="Admin Panel"
          >
            <ShieldCheck className="w-4 h-4" />
          </KokonutButton>
        )}

        {/* Stardust Soft Currency Counter */}
        <KokonutButton
          variant="shimmer"
          size="sm"
          onClick={() => {
            audioManager.playModalOpen('shop');
            onOpenShop();
          }}
          icon={<StardustCrystalIcon size={15} color="#ffb703" glowColor="#ffb703" />}
          title="Stardust"
        >
          <span className="tabular-nums font-pixel text-[10px] sm:text-[11px] font-bold">
            {displayedStardust.toLocaleString()}
          </span>
        </KokonutButton>

        {/* Telegram Stars Shop Button */}
        <KokonutButton
          variant="glass"
          size="sm"
          onClick={() => {
            audioManager.playModalOpen('shop');
            onOpenStarsShop();
          }}
          icon={<StarXtrIcon size={15} color="#ffb703" glowColor="#ffb703" />}
          title="Telegram Stars Shop (XTR)"
          aria-label="Stars Shop"
        >
          <span className="font-pixel text-[9px] sm:text-[10px] text-[#ffb703]">XTR</span>
        </KokonutButton>

        {/* Settings Button */}
        <KokonutButton
          variant="glass"
          size="icon"
          onClick={() => {
            audioManager.playModalOpen('settings');
            onOpenSettings();
          }}
          title={t.settingsTitle}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-[#00f5d4]" />
        </KokonutButton>
      </div>
    </header>
  );
};
