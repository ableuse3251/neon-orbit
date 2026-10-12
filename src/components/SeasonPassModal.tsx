import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { getTranslation, Language } from '../utils/i18n';

interface SeasonPassModalProps {
  isOpen: boolean;
  lang?: Language;
  onClose: () => void;
  onOpenStarsShop: () => void;
}

export const SeasonPassModal: React.FC<SeasonPassModalProps> = ({ isOpen, lang = 'en', onClose, onOpenStarsShop }) => {
  const t = getTranslation(lang);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showWarpEffect, setShowWarpEffect] = useState(false);

  const fetchSeason = async () => {
    setLoading(true);
    try {
      const res = await api.getActiveSeason();
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Error loading active season:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSeason();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClaim = async (tierIndex: number, isPaid: boolean) => {
    setClaiming(tierIndex);
    try {
      const res = await api.claimSeasonReward(tierIndex, isPaid);
      if (res.success) {
        await fetchSeason();
      } else {
        alert(res.error || 'Failed to claim reward');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  const handleUpgradePass = async () => {
    setUpgrading(true);
    setShowWarpEffect(true);
    setTimeout(async () => {
      try {
        const res = await api.upgradeSeasonPass();
        if (res.success) {
          await fetchSeason();
        } else {
          alert(res.error || 'Upgrade failed');
        }
      } catch (err: any) {
        alert(err?.message || 'Upgrade failed');
      } finally {
        setShowWarpEffect(false);
        setUpgrading(false);
      }
    }, 1500);
  };

  const season = data?.season;
  const userStats = data?.userStats;
  const tiers = data?.tiers || [];

  const endsAt = season?.endsAt ? new Date(season.endsAt).getTime() : Date.now() + 86400000 * 7;
  const timeLeft = Math.max(0, endsAt - Date.now());
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-mono-tech select-none">
      {showWarpEffect && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center overflow-hidden animate-pulse">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/40 via-purple-900/60 to-black animate-ping" />
          <div className="relative text-cyan-300 font-pixel text-xl sm:text-2xl tracking-widest uppercase drop-shadow-[0_0_20px_#00F5D4] text-center px-4">
            HYPERSPACE WARP ENGAGED...
          </div>
        </div>
      )}

      <div className="relative w-full max-w-lg bg-[#0d0724] border-2 border-cyan-500/60 rounded-2xl shadow-[0_0_30px_rgba(0,245,212,0.3)] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30 bg-gradient-to-r from-purple-900/60 to-cyan-950/60">
          <div>
            <h2 className="font-pixel text-sm sm:text-base text-cyan-300 tracking-wider">
              {season ? (lang === 'ru' ? season.titleRu : season.titleEn) : 'Neon Season'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-cyan-400/80 mt-0.5">
              <span>{daysLeft}d {hoursLeft}h remaining</span>
              <span aria-hidden="true">·</span>
              <span>Theme: {season?.theme || 'Synthwave'}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition-all text-lg font-bold"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-cyan-400 animate-pulse font-pixel text-xs">
              Loading cosmic orbit telemetry...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-4 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-pixel">Rank</div>
                  <div className="text-xl font-black text-cyan-300 mt-1 font-pixel">#{userStats?.rank || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-pixel">Points</div>
                  <div className="text-xl font-black text-purple-300 mt-1 font-pixel">{userStats?.seasonPoints || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-cyan-400/70 font-pixel">Title</div>
                  <div className="text-xs font-bold text-amber-300 mt-2 truncate font-pixel">{userStats?.rankTitle || 'Pilot'}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-950/70 to-cyan-950/70 border border-purple-500/40 rounded-xl">
                <div>
                  <div className="text-sm font-bold text-purple-200 font-pixel">
                    {userStats?.passTier === 'PAID' ? '👑 Premium Elite Pass Active' : '⚡ Free Orbit Pass'}
                  </div>
                  <div className="text-xs text-purple-300/80 mt-0.5">
                    {userStats?.passTier === 'PAID' ? 'All cosmetic rewards unlocked!' : 'Unlock premium cosmetics for 250 Stars'}
                  </div>
                </div>
                {userStats?.passTier !== 'PAID' && (
                  <button
                    onClick={handleUpgradePass}
                    disabled={upgrading}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(251,191,36,0.5)] hover:scale-105 active:scale-95 transition-all font-pixel"
                  >
                    {upgrading ? 'Upgrading...' : 'Upgrade (250 ⭐)'}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-pixel text-cyan-300 uppercase tracking-wider">Season Pass Tiers</h3>
                {tiers.map((tier: any, idx: number) => {
                  const pointsNeeded = tier.pointsRequired;
                  const currentPoints = userStats?.seasonPoints || 0;
                  const isUnlocked = currentPoints >= pointsNeeded;
                  const claimed = userStats?.rewardsClaimed || {};
                  const freeClaimed = claimed[`free_${idx}`];
                  const paidClaimed = claimed[`paid_${idx}`];

                  return (
                    <div
                      key={tier.tier}
                      className={`border rounded-xl p-4 flex flex-col gap-3 transition-all ${
                        isUnlocked
                          ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_10px_rgba(0,245,212,0.15)]'
                          : 'bg-black/40 border-cyan-500/20 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-cyan-300 font-pixel">
                          Tier {tier.tier} <span className="text-cyan-400/70 font-normal">({pointsNeeded} pts)</span>
                        </div>
                        <div className="text-xs font-medium text-cyan-400/80">
                          {isUnlocked ? 'Unlocked ✓' : `Need ${pointsNeeded - currentPoints} pts`}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between bg-black/60 border border-cyan-500/20 rounded-lg p-2.5">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-cyan-400/70 uppercase font-pixel">Free Track</span>
                            <span className="text-xs font-bold text-cyan-200">{lang === 'ru' ? tier.freeReward.nameRu : tier.freeReward.nameEn}</span>
                          </div>
                          <button
                            onClick={() => handleClaim(idx, false)}
                            disabled={!isUnlocked || freeClaimed || claiming === idx}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-pixel ${
                              freeClaimed
                                ? 'bg-cyan-950/50 text-cyan-500 cursor-not-allowed'
                                : isUnlocked
                                ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,245,212,0.4)] hover:bg-cyan-400'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {freeClaimed ? 'Claimed' : 'Claim'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between bg-purple-950/40 border border-purple-500/30 rounded-lg p-2.5">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-purple-400 uppercase font-pixel">Elite Track ⭐</span>
                            <span className="text-xs font-bold text-purple-200">{lang === 'ru' ? tier.paidReward.nameRu : tier.paidReward.nameEn}</span>
                          </div>
                          <button
                            onClick={() => handleClaim(idx, true)}
                            disabled={!isUnlocked || paidClaimed || userStats?.passTier !== 'PAID' || claiming === idx}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-pixel ${
                              paidClaimed
                                ? 'bg-purple-950/50 text-purple-400 cursor-not-allowed'
                                : userStats?.passTier !== 'PAID'
                                ? 'bg-gray-800 text-purple-400/50 cursor-not-allowed'
                                : isUnlocked
                                ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-[0_0_10px_rgba(251,191,36,0.4)] hover:scale-105'
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {paidClaimed ? 'Claimed' : userStats?.passTier !== 'PAID' ? 'Locked ⭐' : 'Claim'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
