import React, { useEffect, useState } from 'react';
import { Trophy, Calendar, Users, RefreshCw, Loader2, EyeOff } from 'lucide-react';
import { PlayerProfile } from '../types/game';
import { getTranslation } from '../utils/i18n';
import { RankShield3D } from './ui/Icons';
import { audioManager } from '../utils/audio';
import { KokonutModal, KokonutTabs, KokonutCard, KokonutBadge, KokonutButton } from './ui/kokonut';

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
    } catch (err: any) {
      setError(err?.message || 'Error connecting to satellite server');
    } finally {
      setLoading(false);
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
    <KokonutModal
      isOpen={true}
      onClose={onClose}
      title={t.rankingsTitle || 'Hall of Fame'}
      icon={<Trophy className="w-5 h-5 text-[#ffb703]" />}
      badge={
        data?.seasonTitle ? (
          <KokonutBadge variant="pink" size="sm">
            {data.seasonTitle}
          </KokonutBadge>
        ) : undefined
      }
      maxWidth="lg"
    >
      <div className="flex flex-col gap-3">
        {/* Kokonut Segmented Tabs */}
        <KokonutTabs
          tabs={[
            { id: 'daily', label: lang === 'ru' ? 'Ежедневный' : 'Daily', icon: <Calendar className="w-3.5 h-3.5" /> },
            { id: 'global', label: lang === 'ru' ? 'За Всё Время' : 'Global', icon: <Trophy className="w-3.5 h-3.5" /> },
            { id: 'friends', label: lang === 'ru' ? 'Друзья' : 'Friends', icon: <Users className="w-3.5 h-3.5" /> },
          ]}
          activeTab={tab}
          onChange={(tId) => handleTabChange(tId as 'daily' | 'global' | 'friends')}
          layoutId="leaderboardTabPill"
        />

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 text-[#00f5d4] animate-spin" />
            <span className="font-pixel text-xs text-[#00f5d4]">
              {lang === 'ru' ? 'ЗАГРУЗКА ДАННЫХ СПУТНИКА...' : 'SYNCING SATELLITE DATA...'}
            </span>
          </div>
        ) : error ? (
          <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col items-center text-center gap-3">
            <p className="text-xs text-red-400 font-bold">{error}</p>
            <KokonutButton
              variant="outline"
              size="sm"
              onClick={() => fetchLeaderboard(tab)}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {lang === 'ru' ? 'ПОВТОРИТЬ' : 'RETRY'}
            </KokonutButton>
          </KokonutCard>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* User Personal Rank Banner if not in Top 10 list */}
            {data?.currentUser && !isUserInTopList && (
              <KokonutCard variant="glow" hoverEffect={false} className="p-3 flex items-center justify-between border-[#ff007f]/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#ff007f]/20 border border-[#ff007f] flex items-center justify-center font-pixel text-xs text-[#ff007f]">
                    #{data.currentUser.rank ?? '—'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-pixel text-xs text-white font-bold">
                      {lang === 'ru' ? 'ВАША ПОЗИЦИЯ' : 'YOUR POSITION'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-sans">
                      {data.currentUser.rankTitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {data.currentUser.hideFromLeaderboard && (
                    <KokonutBadge variant="gold" size="sm" icon={<EyeOff className="w-3 h-3" />}>
                      HIDDEN
                    </KokonutBadge>
                  )}
                  <span className="font-pixel text-sm text-[#00f5d4] font-bold tabular-nums">
                    {data.currentUser.score.toLocaleString()}
                  </span>
                </div>
              </KokonutCard>
            )}

            {/* Podium Top 3 Cards Grid if available */}
            {data?.entries && data.entries.length >= 3 && (
              <div className="grid grid-cols-3 gap-2 my-1">
                {/* 2nd Place */}
                <KokonutCard variant="glass" hoverEffect={true} className="p-2.5 flex flex-col items-center text-center gap-1 border-gray-400/50">
                  <span className="font-pixel text-[10px] text-gray-400">#2 SILVER</span>
                  <div className="w-10 h-10 rounded-full border border-gray-300 bg-gray-800 flex items-center justify-center font-pixel text-xs font-bold text-gray-200">
                    {data.entries[1].username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-pixel text-[10px] text-white truncate w-full">
                    {data.entries[1].username}
                  </span>
                  <span className="font-pixel text-[10px] text-[#00f5d4] tabular-nums font-bold">
                    {data.entries[1].score.toLocaleString()}
                  </span>
                </KokonutCard>

                {/* 1st Place */}
                <KokonutCard variant="glow" hoverEffect={true} className="p-3 flex flex-col items-center text-center gap-1 border-[#ffb703] scale-105 shadow-[0_0_20px_rgba(255,183,3,0.3)]">
                  <span className="font-pixel text-[10px] text-[#ffb703] font-bold">#1 GOLD</span>
                  <div className="w-12 h-12 rounded-full border-2 border-[#ffb703] bg-[#ffb703]/20 flex items-center justify-center font-pixel text-sm font-bold text-[#ffb703]">
                    {data.entries[0].username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-pixel text-xs text-white truncate w-full font-bold">
                    {data.entries[0].username}
                  </span>
                  <span className="font-pixel text-xs text-[#00f5d4] tabular-nums font-bold">
                    {data.entries[0].score.toLocaleString()}
                  </span>
                </KokonutCard>

                {/* 3rd Place */}
                <KokonutCard variant="glass" hoverEffect={true} className="p-2.5 flex flex-col items-center text-center gap-1 border-amber-600/50">
                  <span className="font-pixel text-[10px] text-amber-500">#3 BRONZE</span>
                  <div className="w-10 h-10 rounded-full border border-amber-600 bg-amber-950 flex items-center justify-center font-pixel text-xs font-bold text-amber-400">
                    {data.entries[2].username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-pixel text-[10px] text-white truncate w-full">
                    {data.entries[2].username}
                  </span>
                  <span className="font-pixel text-[10px] text-[#00f5d4] tabular-nums font-bold">
                    {data.entries[2].score.toLocaleString()}
                  </span>
                </KokonutCard>
              </div>
            )}

            {/* Leaderboard Entries List */}
            <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
              {data?.entries?.map((entry) => {
                const isMe = entry.isCurrentUser || String(entry.userId) === String(currentUserId);
                return (
                  <KokonutCard
                    key={entry.userId}
                    variant={isMe ? 'glow' : 'glass'}
                    hoverEffect={true}
                    className={`flex items-center justify-between p-2.5 sm:p-3 border ${
                      isMe ? 'border-[#00f5d4] shadow-[0_0_15px_rgba(0,245,212,0.3)]' : 'border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 shrink-0 flex items-center justify-center font-pixel text-xs font-bold text-gray-300">
                        #{entry.rank}
                      </div>

                      <RankShield3D tier={getRankBadgeTier(entry.rank)} size={24} />

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-pixel text-xs text-white truncate font-bold">
                            {entry.username || entry.firstName}
                          </span>
                          {isMe && (
                            <KokonutBadge variant="cyan" size="sm">
                              YOU
                            </KokonutBadge>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-sans truncate">
                          {entry.rankTitle}
                        </span>
                      </div>
                    </div>

                    <span className="font-pixel text-xs sm:text-sm text-[#00f5d4] font-bold tabular-nums shrink-0">
                      {entry.score.toLocaleString()}
                    </span>
                  </KokonutCard>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </KokonutModal>
  );
};
