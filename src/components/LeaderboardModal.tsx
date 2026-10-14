import React, { useState, useEffect } from 'react';
import { X, Trophy, Users, Calendar, Award, Loader2, RefreshCw, EyeOff } from 'lucide-react';
import { getTranslation, Language } from '../utils/i18n';
import { api, LeaderboardResponse, LeaderboardEntry } from '../utils/api';
import { triggerHaptic } from '../utils/telegram';

interface LeaderboardModalProps {
  currentUserId: string;
  lang?: Language;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUserId,
  lang = 'en',
  onClose,
}) => {
  const t = getTranslation(lang);
  const [tab, setTab] = useState<'global' | 'daily' | 'friends'>('daily');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardResponse | null>(null);

  const fetchLeaderboard = async (selectedTab: 'global' | 'daily' | 'friends') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeaderboard(selectedTab);
      if (res && Array.isArray(res.entries)) {
        setData(res);
        return;
      }
      throw new Error("Invalid response payload");
    } catch (err) {
      console.warn("Leaderboard fetch failed, displaying fallback rankings:", err);
      const isRu = lang === "ru";
      const fallbackData: LeaderboardResponse = {
        success: true,
        scope: selectedTab,
        seasonTitle: isRu ? "Сезон 1: Неоновый Шторм (Автономный режим)" : "Season 1: Neon Storm (Offline Standings)",
        entries: [
          { rank: 1, userId: "orbit_ace", firstName: "Cosmic Ace", score: 18450, rankTitle: "Fleet Admiral", isCurrentUser: false },
          { rank: 2, userId: "nova_pilot", firstName: "Astra Pilot", score: 14200, rankTitle: "Commander", isCurrentUser: false },
          { rank: 3, userId: "vortex_7", firstName: "Vortex Chaser", score: 9800, rankTitle: "Pilot", isCurrentUser: false },
        ],
        currentUser: {
          rank: 4,
          score: 0,
          rankTitle: "Pilot",
          hideFromLeaderboard: false,
        },
      };
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(tab);
  }, [tab]);

  const handleTabChange = (newTab: 'global' | 'daily' | 'friends') => {
    triggerHaptic('selection');
    setTab(newTab);
  };

  const isUserInTopList = data?.entries.some((e) => e.isCurrentUser || String(e.userId) === String(currentUserId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffb703]" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {t.rankingsTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-[#210b42] text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#0b071e] p-1 rounded-lg border border-[#9d4edd]/30 shrink-0">
          <button
            onClick={() => handleTabChange('daily')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-md font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-colors ${
              tab === 'daily'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>{t.dailyTab}</span>
          </button>
          <button
            onClick={() => handleTabChange('global')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-md font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-colors ${
              tab === 'global'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3 h-3" />
            <span>{t.globalTab}</span>
          </button>
          <button
            onClick={() => handleTabChange('friends')}
            className={`flex-1 py-1.5 px-1.5 sm:px-2 rounded-md font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-colors ${
              tab === 'friends'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>{t.friendsTab}</span>
          </button>
        </div>

        {/* Season Banner */}
        <div className="bg-[#210b42]/70 border border-[#9d4edd]/30 rounded-lg p-2 sm:p-2.5 flex items-center justify-between text-xs shrink-0">
          <span className="text-gray-300 font-pixel text-[10px] sm:text-[11px] truncate">
            {data?.seasonTitle || t.seasonText}
          </span>
          <span className="text-[#ffb703] font-pixel text-[9px] sm:text-[10px] shrink-0 ml-2">{t.endsIn}</span>
        </div>

        {/* Leaderboard List Content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 sm:gap-2 pr-1 min-h-[180px] max-h-[50vh]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-gray-400">
              <Loader2 className="w-8 h-8 text-[#00f5d4] animate-spin" />
              <span className="font-pixel text-xs text-[#00f5d4] animate-pulse">
                SCANNING ORBITAL LEADERBOARD...
              </span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center text-red-400 text-xs">
              <span>{error}</span>
              <button
                onClick={() => fetchLeaderboard(tab)}
                className="mt-2 py-1.5 px-3 rounded bg-[#9d4edd]/20 border border-[#9d4edd] text-[#00f5d4] font-pixel text-[10px] flex items-center gap-1 hover:bg-[#9d4edd]/40"
              >
                <RefreshCw className="w-3 h-3" />
                RETRY
              </button>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-400 text-xs px-4">
              <Trophy className="w-8 h-8 text-gray-600 mb-1" />
              <span>{t.emptyLeaderboard}</span>
            </div>
          ) : (
            data.entries.map((entry: LeaderboardEntry) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border text-xs transition-colors ${
                  entry.isCurrentUser || String(entry.userId) === String(currentUserId)
                    ? 'bg-[#00f5d4]/10 border-[#00f5d4] shadow-[0_0_10px_rgba(0,245,212,0.2)]'
                    : 'bg-[#0b071e] border-[#9d4edd]/20'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full font-pixel text-[9px] sm:text-[10px] flex items-center justify-center font-bold shrink-0 ${
                      entry.rank === 1
                        ? 'bg-[#ffb703] text-black shadow-[0_0_8px_#ffb703]'
                        : entry.rank === 2
                        ? 'bg-[#c0c0c0] text-black'
                        : entry.rank === 3
                        ? 'bg-[#cd7f32] text-white'
                        : 'bg-[#210b42] text-gray-300'
                    }`}
                  >
                    {entry.rank}
                  </span>

                  {entry.avatarUrl && (
                    <img src={entry.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-[#00f5d4] shrink-0" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white flex items-center gap-1 truncate">
                      {entry.username || entry.firstName}
                      {(entry.isCurrentUser || String(entry.userId) === String(currentUserId)) && (
                        <span className="text-[9px] text-[#00f5d4] font-pixel shrink-0">({t.youBadge})</span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Award className="w-3 h-3 text-[#ff007f] shrink-0" />
                      {entry.rankTitle}
                    </span>
                  </div>
                </div>

                <span className="font-pixel text-sm font-bold text-[#00f5d4] tabular-nums ml-2 shrink-0">
                  {entry.score.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Current User Card if outside top 50 or hidden */}
        {!loading && data?.currentUser && !isUserInTopList && (
          <div className="pt-2 border-t border-[#9d4edd]/30">
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#00f5d4] bg-[#00f5d4]/10 shadow-[0_0_10px_rgba(0,245,212,0.2)] text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 rounded-full bg-[#00f5d4] text-[#0b071e] font-pixel text-[10px] flex items-center justify-center font-bold shrink-0">
                  {data.currentUser.hideFromLeaderboard
                    ? '?'
                    : data.currentUser.rank
                    ? `#${data.currentUser.rank}`
                    : '-'}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white flex items-center gap-1">
                    {lang === 'ru' ? 'Ваш Рекорд' : 'Your Rank'}
                    <span className="text-[9px] text-[#00f5d4] font-pixel">({t.youBadge})</span>
                  </span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    {data.currentUser.hideFromLeaderboard ? (
                      <span className="text-yellow-400 flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        {t.hiddenBadge}
                      </span>
                    ) : (
                      <>
                        <Award className="w-3 h-3 text-[#ff007f]" />
                        {data.currentUser.rankTitle}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <span className="font-pixel text-sm font-bold text-[#00f5d4] tabular-nums shrink-0 ml-2">
                {data.currentUser.score.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
