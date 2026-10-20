import React, { useEffect, useState } from 'react';
import { X, Trophy, Calendar, Users, RefreshCw, Loader2, EyeOff } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { RankShield3D } from './ui/Icons';

interface LeaderboardEntry {
  userId: number;
  username: string;
  firstName: string;
  avatarUrl?: string;
  rank: number;
  score: number;
  rankTitle: string;
  isCurrentUser?: boolean;
}

interface LeaderboardData {
  timeframe: string;
  entries: LeaderboardEntry[];
  currentUser?: {
    rank: number | null;
    score: number;
    rankTitle: string;
    hideFromLeaderboard?: boolean;
  };
  seasonTitle?: string;
}

interface LeaderboardModalProps {
  currentUserId: number | string;
  lang: 'en' | 'ru';
  onClose: () => void;
  profile?: PlayerProfile;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentUserId,
  lang,
  onClose,
  profile,
}) => {
  const t = getTranslation(lang);
  const [tab, setTab] = useState<'daily' | 'global' | 'friends'>('global');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeaderboardData | null>(null);

  const fetchLeaderboard = async (timeframe: 'daily' | 'global' | 'friends') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?timeframe=${timeframe}`, {
        headers: {
          'x-telegram-init-data': window.Telegram?.WebApp?.initData || '',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load leaderboard data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {      setError(err?.message || 'Error connecting to satellite server');
    } finally {      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(tab);
  }, [tab]);

  const handleTabChange = (newTab: 'daily' | 'global' | 'friends') => {
    if (newTab !== tab) {
      setTab(newTab);
    }
  };

  const isUserInTopList =
    data?.entries?.some((e) => e.isCurrentUser || String(e.userId) === String(currentUserId)) ?? false;

  const getRankBadgeTier = (rank: number) => {
    if (rank === 1) return 'grandmaster';
    if (rank === 2) return 'master';
    if (rank === 3) return 'diamond';
    if (rank <= 10) return 'platinum';
    if (rank <= 25) return 'gold';
    if (rank <= 50) return 'silver';
    return 'bronze';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e]/95 border-2 border-[#9d4edd] rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(157,78,221,0.35)] flex flex-col gap-3.5 text-white max-h-[94vh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#ffb703] animate-bounce" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] uppercase tracking-wider">
              {t.rankingsTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#210b42] text-gray-400 hover:text-white border border-[#9d4edd]/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#0b071e] p-1 rounded-xl border border-[#9d4edd]/30 shrink-0">
          <button
            onClick={() => handleTabChange('daily')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-all ${
              tab === 'daily'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold shadow-[0_0_10px_#00f5d4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>{t.dailyTab}</span>
          </button>
          <button
            onClick={() => handleTabChange('global')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-all ${
              tab === 'global'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold shadow-[0_0_10px_#00f5d4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3 h-3" />
            <span>{t.globalTab}</span>
          </button>
          <button
            onClick={() => handleTabChange('friends')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-pixel text-[9px] sm:text-[10px] flex items-center justify-center gap-1 transition-all ${
              tab === 'friends'
                ? 'bg-[#00f5d4] text-[#0b071e] font-bold shadow-[0_0_10px_#00f5d4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>{t.friendsTab}</span>
          </button>
        </div>

        {/* Season Banner */}
        <div className="bg-[#210b42]/80 border border-[#9d4edd]/40 rounded-xl p-2.5 flex items-center justify-between text-xs shrink-0 shadow-sm">
          <span className="text-gray-300 font-pixel text-[10px] sm:text-[11px] truncate">
            {data?.seasonTitle || t.seasonText}
          </span>
          <span className="text-[#ffb703] font-pixel text-[9px] sm:text-[10px] shrink-0 ml-2 font-bold">{t.endsIn}</span>
        </div>

        {/* Leaderboard List Content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-[200px] max-h-[50vh] scrollbar-thin scrollbar-thumb-[#9d4edd]/40">
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
                className="mt-2 py-1.5 px-3 rounded-lg bg-[#9d4edd]/20 border border-[#9d4edd] text-[#00f5d4] font-pixel text-[10px] flex items-center gap-1 hover:bg-[#9d4edd]/40"
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
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                  entry.isCurrentUser || String(entry.userId) === String(currentUserId)
                    ? 'bg-[#00f5d4]/10 border-2 border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.25)]'
                    : 'bg-[#0b071e]/90 border-[#9d4edd]/30 hover:border-[#9d4edd]/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <RankShield3D tier={getRankBadgeTier(entry.rank)} size={30} />

                  {entry.avatarUrl && (
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover border border-[#00f5d4] shrink-0"
                    />
                  )}

                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white flex items-center gap-1 truncate font-pixel text-[11px]">
                      {entry.username || entry.firstName}
                      {(entry.isCurrentUser || String(entry.userId) === String(currentUserId)) && (
                        <span className="text-[9px] text-[#00f5d4] font-pixel shrink-0">({t.youBadge})</span>
                      )}
                    </span>
                    <span className="text-[9px] text-gray-400 flex items-center gap-1">
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

        {/* Current User Card if outside top 50 */}
        {!loading && data?.currentUser && !isUserInTopList && (
          <div className="pt-2 border-t border-[#9d4edd]/30">
            <div className="flex items-center justify-between p-3 rounded-xl border-2 border-[#00f5d4] bg-[#00f5d4]/10 shadow-[0_0_12px_rgba(0,245,212,0.2)] text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[#00f5d4] text-[#0b071e] font-pixel text-[11px] flex items-center justify-center font-bold shrink-0">
                  {data.currentUser.hideFromLeaderboard
                    ? '?'
                    : data.currentUser.rank
                    ? `#${data.currentUser.rank}`
                    : '-'}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white flex items-center gap-1 font-pixel text-[11px]">
                    {profile?.username || (lang === 'ru' ? 'Ваш Рекорд' : 'Your Rank')}
                    <span className="text-[9px] text-[#00f5d4] font-pixel">({t.youBadge})</span>
                  </span>
                  <span className="text-[9px] text-gray-400 flex items-center gap-1">
                    {data.currentUser.hideFromLeaderboard ? (
                      <span className="text-yellow-400 flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        {t.hiddenBadge}
                      </span>
                    ) : (
                      data.currentUser.rankTitle
                    )}
                  </span>
                </div>
              </div>
              <span className="font-pixel text-sm font-bold text-[#00f5d4] tabular-nums shrink-0 ml-2">
                {(tab === 'daily' ? data.currentUser.score : Math.max(data.currentUser.score, profile?.highScore || 0)).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
