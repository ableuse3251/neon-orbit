import React from 'react';
import { Settings, ShieldCheck } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { getLevelFromXp } from '../utils/progression';
import { StardustCrystalIcon, StarXtrIcon } from './ui/Icons';

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

  return (
    <header className="w-full bg-[#0d0722]/95 border-b border-[#9d4edd]/30 px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between backdrop-blur-xl z-30 font-mono-tech select-none shrink-0 pt-[max(0.4rem,env(safe-area-inset-top,0px))] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Pilot Avatar & Level (Click opens Flight Logbook Profile) */}
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-[#1a0c3b]/80 transition-all border border-transparent hover:border-[#00f5d4]/40 text-left min-w-0 active:scale-95 group"
      >
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[#1c0d38] border-2 border-[#00f5d4] flex items-center justify-center shadow-[0_0_12px_rgba(0,245,212,0.4)] group-hover:shadow-[0_0_18px_rgba(0,245,212,0.8)] overflow-hidden transition-all">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <span className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] font-bold">
              {lvlInfo.level}
            </span>
          )}

          <span className="absolute -bottom-1 -right-1 bg-[#ff007f] text-white text-[7px] font-pixel px-1 rounded-full shadow-[0_0_6px_#ff007f] border border-black/50">
            LVL {lvlInfo.level}
          </span>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="font-pixel text-[10px] sm:text-[11px] text-white flex items-center gap-1.5 truncate max-w-[120px] sm:max-w-[180px]">
            <span className="truncate group-hover:text-[#00f5d4] transition-colors">
              {profile.username || profile.firstName}
            </span>
            <span className="text-[7px] sm:text-[8px] text-[#ffb703] bg-[#1a0c3b] px-1 py-0.2 rounded-md border border-[#ffb703]/50 shrink-0 hidden xs:inline">
              {localizedRankTitle}
            </span>
            {profile.isDemo && (
              <span className="text-[7px] text-[#00f5d4] bg-[#00f5d4]/10 border border-[#00f5d4]/50 px-1 py-0.2 rounded-md font-pixel shrink-0">
                DEMO
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-gray-400">
            <span>{t.record}:</span>
            <strong className="text-[#00f5d4] font-pixel tabular-nums truncate">
              {profile.highScore.toLocaleString()}
            </strong>
          </div>
        </div>
      </button>

      {/* Action Buttons & Currency */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Admin Live Ops Access Button (if authorized) */}
        {profile.isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="p-1.5 sm:p-2 rounded-xl bg-[#ff007f]/20 border border-[#ff007f] text-[#ff007f] hover:bg-[#ff007f] hover:text-white transition-all active:scale-95 shadow-[0_0_10px_rgba(255,0,127,0.3)]"
            title="Live Ops Admin Panel"
            aria-label="Admin Panel"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Stardust Soft Currency Counter */}
        <button
          type="button"
          onClick={onOpenShop}
          className="flex items-center gap-1 sm:gap-1.5 bg-[#1a0c3b] px-2 sm:px-2.5 py-1 rounded-xl border border-[#ffb703]/60 text-[#ffb703] cursor-pointer hover:border-[#00f5d4] hover:text-white active:scale-95 transition-all shadow-[0_0_10px_rgba(255,183,3,0.25)]"
          title="Stardust"
        >
          <StardustCrystalIcon size={14} color="#ffb703" glowColor="#ffb703" />
          <span className="font-pixel text-[9px] sm:text-[10px] font-bold tabular-nums">
            {profile.stardust}
          </span>
        </button>

        {/* Telegram Stars Shop Button */}
        <button
          type="button"
          onClick={onOpenStarsShop}
          className="px-2 py-1 rounded-xl bg-[#1a0c3b] border border-[#ffb703]/60 text-[#ffb703] hover:border-[#00f5d4] hover:text-white active:scale-95 transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(255,183,3,0.25)]"
          title="Telegram Stars Shop (XTR)"
          aria-label="Stars Shop"
        >
          <StarXtrIcon size={14} color="#ffb703" glowColor="#ffb703" />
          <span className="font-pixel text-[8px] sm:text-[9px] font-bold">XTR</span>
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 sm:p-2 rounded-xl bg-[#1a0c3b] border border-[#9d4edd]/50 text-gray-200 hover:text-[#00f5d4] hover:border-[#00f5d4] active:scale-95 transition-all shadow-[0_0_8px_rgba(157,78,221,0.2)]"
          title={t.settingsTitle}
          aria-label="Settings"
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </header>
  );
};
