import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Share2, Trophy, Award, Zap, Crosshair, RefreshCw, AlertTriangle, ShieldCheck, Gamepad2, Home } from 'lucide-react';
import { animate } from 'animejs';
import { RoundStats, PlayerProfile } from '../types/game';
import { shareChallengeLink, triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';
import { audioManager } from '../utils/audio';
import { KokonutModal, KokonutCard, KokonutButton, KokonutBadge } from './ui/kokonut';

interface FlightLogModalProps {
  stats: RoundStats;
  profile: PlayerProfile;
  botUsername?: string;
  isDemo?: boolean;
  submissionState?: 'idle' | 'submitting' | 'confirmed' | 'pending' | 'rejected';
  submissionReason?: string;
  onRetrySubmission?: () => void;
  onRestart: () => void;
  onOpenLeaderboard: () => void;
  onHome?: () => void;
}

export const FlightLogModal: React.FC<FlightLogModalProps> = ({
  stats,
  profile,
  botUsername = 'Neon_orbitbot',
  isDemo = false,
  submissionState = 'confirmed',
  submissionReason,
  onRetrySubmission,
  onRestart,
  onOpenLeaderboard,
  onHome,
}) => {
  const t = getTranslation(profile.lang);
  const isNewRecord = !isDemo && stats.score > profile.highScore;
  const [copiedLink, setCopiedLink] = useState(false);

  // Animated rolling stats using Anime.js
  const [displayedScore, setDisplayedScore] = useState(0);
  const [displayedAccuracy, setDisplayedAccuracy] = useState(0);
  const [displayedHits, setDisplayedHits] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplayedScore(stats.score);
      setDisplayedAccuracy(stats.accuracy);
      setDisplayedHits(stats.hits);
      return;
    }

    // Rolling odometer counters
    const counter = {
      score: 0,
      accuracy: 0,
      hits: 0,
    };

    try {
      animate(counter, {
        score: stats.score,
        accuracy: stats.accuracy,
        hits: stats.hits,
        duration: 800,
        ease: 'outExpo',
        onUpdate: () => {
          setDisplayedScore(Math.round(counter.score));
          setDisplayedAccuracy(Math.round(counter.accuracy));
          setDisplayedHits(Math.round(counter.hits));
        },
      });
    } catch {
      setDisplayedScore(stats.score);
      setDisplayedAccuracy(stats.accuracy);
      setDisplayedHits(stats.hits);
    }
  }, [stats.score, stats.accuracy, stats.hits, isNewRecord]);

  const handleShareStoryOrLink = () => {
    triggerHaptic('success');
    const challengeId = `ch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    shareChallengeLink(botUsername, challengeId, stats.score);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <KokonutModal
      isOpen={true}
      onClose={() => {
        if (onHome) onHome();
      }}
      title={t.flightLogTitle}
      icon={<Award className="w-5 h-5 text-[#00f5d4] animate-pulse" />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-3">
        {/* Demo Mode Notice */}
        {isDemo && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-3 flex items-center justify-center gap-2 text-center text-purple-200">
            <Gamepad2 className="w-4 h-4 text-purple-300 shrink-0" />
            <span className="font-pixel text-[10px] uppercase tracking-wide">
              {profile.lang === 'ru'
                ? '🎮 ДЕМО-РЕЖИМ (БЕЗ РЕЙТИНГА)'
                : '🎮 DEMO MODE (UNRATED)'}
            </span>
          </KokonutCard>
        )}

        {/* Server Submission Status Banners */}
        {!isDemo && submissionState === 'confirmed' && (
          <KokonutCard variant="glass" hoverEffect={false} className="p-2.5 flex items-center justify-center gap-2 text-emerald-300 border-emerald-500/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-pixel text-[10px] uppercase">
              {profile.lang === 'ru' ? 'Результат подтверждён сервером' : 'Server Verified & Rewards Granted'}
            </span>
          </KokonutCard>
        )}

        {isNewRecord && (
          <KokonutCard variant="glow" hoverEffect={false} className="p-3 flex items-center justify-center gap-2 border-[#ffb703] text-center">
            <Trophy className="w-5 h-5 text-[#ffb703] animate-bounce" />
            <span className="font-pixel text-xs text-[#ffb703] uppercase tracking-wide">
              {t.newRecord}
            </span>
          </KokonutCard>
        )}

        {/* Score Bento Box */}
        <KokonutCard variant="glow" hoverEffect={false} className="p-4 flex flex-col items-center justify-center text-center gap-1">
          <span className="font-pixel text-[10px] text-gray-400 uppercase">{t.finalScore || 'FINAL SCORE'}</span>
          <span className="font-pixel text-3xl sm:text-4xl text-[#00f5d4] text-glow-cyan font-bold tabular-nums">
            {displayedScore.toLocaleString()}
          </span>
        </KokonutCard>

        {/* Round Detailed Stats Bento Grid */}
        <div className="grid grid-cols-3 gap-2">
          <KokonutCard variant="glass" hoverEffect={false} className="p-3 flex flex-col items-center text-center gap-1">
            <Crosshair className="w-4 h-4 text-[#ff007f]" />
            <span className="font-pixel text-[9px] text-gray-400">{t.accuracy || 'ACCURACY'}</span>
            <span className="font-pixel text-xs text-white font-bold tabular-nums">{displayedAccuracy}%</span>
          </KokonutCard>

          <KokonutCard variant="glass" hoverEffect={false} className="p-3 flex flex-col items-center text-center gap-1">
            <Zap className="w-4 h-4 text-[#ffb703]" />
            <span className="font-pixel text-[9px] text-gray-400">{t.hitsTaps || 'HITS'}</span>
            <span className="font-pixel text-xs text-white font-bold tabular-nums">{displayedHits}</span>
          </KokonutCard>

          <KokonutCard variant="glass" hoverEffect={false} className="p-3 flex flex-col items-center text-center gap-1">
            <Trophy className="w-4 h-4 text-[#9d4edd]" />
            <span className="font-pixel text-[9px] text-gray-400">{t.maxCombo || 'MAX COMBO'}</span>
            <span className="font-pixel text-xs text-white font-bold tabular-nums">x{stats.maxCombo || 1}</span>
          </KokonutCard>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <KokonutButton
            variant="glow"
            size="lg"
            onClick={() => {
              audioManager.playNavAction(1.2);
              onRestart();
            }}
            icon={<RotateCcw className="w-4 h-4" />}
            className="w-full"
          >
            {t.playAgain || 'PLAY AGAIN'}
          </KokonutButton>

          <div className="grid grid-cols-2 gap-2">
            <KokonutButton
              variant="shimmer"
              size="md"
              onClick={handleShareStoryOrLink}
              icon={<Share2 className="w-4 h-4" />}
            >
              {copiedLink ? (profile.lang === 'ru' ? 'ССЫЛКА СКОПИРОВАНА' : 'LINK COPIED') : (t.challengeFriend || 'CHALLENGE FRIENDS')}
            </KokonutButton>

            <KokonutButton
              variant="glass"
              size="md"
              onClick={onOpenLeaderboard}
              icon={<Trophy className="w-4 h-4 text-[#ffb703]" />}
            >
              {t.leaderboardBtn || 'HALL OF FAME'}
            </KokonutButton>
          </div>

          {onHome && (
            <KokonutButton
              variant="ghost"
              size="sm"
              onClick={onHome}
              icon={<Home className="w-4 h-4" />}
              className="w-full mt-1"
            >
              {t.toMainMenu || 'MAIN MENU'}
            </KokonutButton>
          )}
        </div>
      </div>
    </KokonutModal>
  );
};
