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
    <header className="relative w-full bg-[#080417]/90 border-b border-[#00f5d4]/20 px-3 sm:px-5 py-2 flex items-center justify-between backdrop-blur-2xl z-30 font-mono-tech select-none shrink-0 pt-[max(0.5rem,env(safe-area-inset-top,0px))] shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
      {/* Top Subtle Neon Beam Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f5d4]/50 to-transparent pointer-events-none" />

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
        className="flex items-center gap-2.5 cursor-pointer p-1 rounded-2xl hover:bg-[#180b35]/80 transition-colors border border-transparent hover:border-[#00f5d4]/30 text-left min-w-0 group"
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
            <span className="text-[7px] sm:text-[8px] text-[#ffb703] bg-[#1a0c3b]/90 px-1.5 py-0.5 rounded-md border border-[#ffb703]/50 shrink-0 hidden xs:inline uppercase tracking-wider font-semibold">
              {localizedRankTitle}
            </span>
            {profile.isDemo && (
              <span className="text-[7px] text-[#00f5d4] bg-[#00f5d4]/10 border border-[#00f5d4]/50 px-1 py-0.2 rounded-md font-pixel shrink-0 animate-pulse">
                DEMO
              </span>
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

      {/* Action Buttons & Currency */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Admin Live Ops Access Button (if authorized) */}
        {profile.isAdmin && onOpenAdminPanel && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onMouseEnter={() => audioManager.playNavHover()}
            onClick={() => {
              audioManager.playModalOpen('admin');
              triggerHaptic('light');
              onOpenAdminPanel();
            }}
            className="p-2 rounded-xl bg-[#ff007f]/15 border border-[#ff007f]/70 text-[#ff007f] hover:bg-[#ff007f] hover:text-white transition-all shadow-[0_0_12px_rgba(255,0,127,0.35)]"
            title="Live Ops Admin Panel"
            aria-label="Admin Panel"
          >
            <ShieldCheck className="w-4 h-4 sm:w-4 sm:h-4" />
          </motion.button>
        )}

        {/* Stardust Soft Currency Counter with Anime.js rolling value */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 20 }}
          onMouseEnter={() => audioManager.playNavHover()}
          onClick={() => {
            audioManager.playModalOpen('shop');
            triggerHaptic('selection');
            onOpenShop();
          }}
          className="flex items-center gap-1.5 bg-[#15092f]/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[#ffb703]/50 text-[#ffb703] cursor-pointer hover:border-[#00f5d4] hover:text-white transition-all shadow-[0_0_12px_rgba(255,183,3,0.2)] hover:shadow-[0_0_16px_rgba(0,245,212,0.3)] group"
          title="Stardust"
        >
          <StardustCrystalIcon size={15} color="#ffb703" glowColor="#ffb703" className="group-hover:scale-110 transition-transform" />
          <span className="font-pixel text-[10px] sm:text-[11px] font-bold tabular-nums">
            {displayedStardust.toLocaleString()}
          </span>
        </motion.button>

        {/* Telegram Stars Shop Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 20 }}
          onMouseEnter={() => audioManager.playNavHover()}
          onClick={() => {
            audioManager.playModalOpen('shop');
            triggerHaptic('selection');
            onOpenStarsShop();
          }}
          className="px-2.5 py-1.5 rounded-xl bg-[#15092f]/90 border border-[#ffb703]/50 text-[#ffb703] hover:border-[#00f5d4] hover:text-white transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,183,3,0.2)] hover:shadow-[0_0_16px_rgba(0,245,212,0.3)] group"
          title="Telegram Stars Shop (XTR)"
          aria-label="Stars Shop"
        >
          <StarXtrIcon size={15} color="#ffb703" glowColor="#ffb703" className="group-hover:scale-110 transition-transform" />
          <span className="font-pixel text-[9px] sm:text-[10px] font-bold tracking-tight">XTR</span>
        </motion.button>

        {/* Settings */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 450, damping: 20 }}
          onMouseEnter={() => audioManager.playNavHover()}
          onClick={() => {
            audioManager.playModalOpen('settings');
            triggerHaptic('selection');
            onOpenSettings();
          }}
          className="p-2 rounded-xl bg-[#15092f]/90 border border-[#9d4edd]/40 text-gray-300 hover:text-[#00f5d4] hover:border-[#00f5d4] transition-all shadow-[0_0_10px_rgba(157,78,221,0.15)] hover:shadow-[0_0_15px_rgba(0,245,212,0.25)]"
          title={t.settingsTitle}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </motion.button>
      </div>
    </header>
  );
};
