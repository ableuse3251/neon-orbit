import React, { useRef, useState } from 'react';
import { RotateCcw, Share2, Trophy, Award, Zap, Crosshair, RefreshCw, AlertTriangle, ShieldCheck, Gamepad2 } from 'lucide-react';
import { RoundStats, PlayerProfile } from '../types/game';
import { shareChallengeLink, triggerHaptic } from '../utils/telegram';
import { getTranslation } from '../utils/i18n';

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
}) => {
  const t = getTranslation(profile.lang);
  const isNewRecord = !isDemo && stats.score > profile.highScore;
  const [copiedLink, setCopiedLink] = useState(false);
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const localizedRankTitle =
    profile.rankTitle === 'Fleet Admiral'
      ? t.rankAdmiral
      : profile.rankTitle === 'Commander'
      ? t.rankCommander
      : t.rankPilot;

  const handleShareStoryOrLink = () => {
    triggerHaptic('success');
    const challengeId = `ch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    shareChallengeLink(botUsername, challengeId, stats.score);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono-tech select-none">
      <div className="relative w-full max-w-md bg-[#120a2e] border-2 border-[#9d4edd] rounded-xl p-3.5 sm:p-5 shadow-[0_0_30px_rgba(157,78,221,0.3)] flex flex-col gap-3 sm:gap-4 text-white max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#9d4edd]/40 pb-2.5 sm:pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff007f] animate-ping" />
            <h2 className="font-pixel text-[11px] sm:text-xs text-[#00f5d4] tracking-wider uppercase">
              {t.flightLogTitle}
            </h2>
          </div>
          <span className="text-[10px] text-gray-400 font-mono-tech">
            {new Date().toLocaleTimeString()}
          </span>
        </div>

        {/* Demo Mode Notice */}
        {isDemo && (
          <div className="bg-purple-950/90 border border-purple-400/80 rounded-lg p-2.5 text-center flex items-center justify-center gap-2 text-purple-200">
            <Gamepad2 className="w-4 h-4 text-purple-300 shrink-0" />
            <span className="font-pixel text-[10px] uppercase tracking-wide">
              {profile.lang === 'ru'
                ? '🎮 ДЕМО-РЕЖИМ (БЕЗ РЕЙТИНГА) — Очки и награды не отправляются на сервер'
                : '🎮 DEMO MODE (UNRATED) — Stats not submitted to server profile'}
            </span>
          </div>
        )}

        {/* Backend Verification & Submission Status Banners */}
        {!isDemo && submissionState === 'submitting' && (
          <div className="bg-cyan-950/80 border border-cyan-500/80 rounded-lg p-2.5 text-center flex items-center justify-center gap-2 text-cyan-200 animate-pulse">
            <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            <span className="font-pixel text-[10px] uppercase tracking-wide">
              {profile.lang === 'ru' ? 'Проверка результатов на сервере...' : 'Verifying round on server...'}
            </span>
          </div>
        )}

        {!isDemo && submissionState === 'confirmed' && (
          <div className="bg-emerald-950/80 border border-emerald-500/80 rounded-lg p-2 text-center flex items-center justify-center gap-2 text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-pixel text-[10px] uppercase tracking-wide">
              {profile.lang === 'ru' ? 'Результат подтверждён сервером' : 'Server Verified & Rewards Granted'}
            </span>
          </div>
        )}

        {!isDemo && submissionState === 'pending' && (
          <div className="bg-amber-950/90 border border-amber-500 rounded-lg p-2.5 flex flex-col items-center gap-2 text-amber-200">
            <div className="flex items-center gap-2 text-center">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-pixel text-[10px] uppercase">
                {profile.lang === 'ru'
                  ? 'Ошибка сети. Раунд сохранён локально для повтора'
                  : 'Network issue. Submission pending retry'}
              </span>
            </div>
            {onRetrySubmission && (
              <button
                onClick={onRetrySubmission}
                className="py-1 px-3 bg-amber-600 hover:bg-amber-500 text-black font-pixel text-[10px] rounded font-bold transition-all flex items-center gap-1.5 shadow"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{profile.lang === 'ru' ? 'Повторить отправку' : 'Retry Submission'}</span>
              </button>
            )}
          </div>
        )}

        {!isDemo && submissionState === 'rejected' && (
          <div className="bg-red-950/90 border border-red-500 rounded-lg p-2.5 text-center flex flex-col items-center gap-1 text-red-200">
            <span className="font-pixel text-[10px] uppercase font-bold text-red-400">
              {profile.lang === 'ru' ? 'Результат отклонен сервером' : 'Submission Rejected'}
            </span>
            {submissionReason && <span className="text-[10px] opacity-80">{submissionReason}</span>}
          </div>
        )}

        {isNewRecord && (
          <div className="bg-[#ff007f]/20 border border-[#ff007f] rounded-lg p-2.5 text-center flex items-center justify-center gap-2 animate-bounce">
            <Trophy className="w-5 h-5 text-[#ffb703]" />
            <span className="font-pixel text-xs text-[#ffb703] uppercase tracking-wide">
              {t.newRecord}
            </span>
          </div>
        )}

        <div className="bg-[#0b071e] border border-[#9d4edd]/30 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-400 uppercase font-pixel">{t.finalScore}</span>
            <span className="font-pixel text-3xl font-bold text-[#00f5d4] text-glow-cyan tabular-nums">
              {stats.score.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#9d4edd]/20 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#ffb703]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400">{t.maxCombo}</span>
                <span className="font-pixel text-white text-sm">x{stats.maxCombo}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#00f5d4]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400">{t.accuracy}</span>
                <span className="font-pixel text-white text-sm">{stats.accuracy}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#ff007f]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400">{t.hitsTaps}</span>
                <span className="font-pixel text-white text-sm">
                  {stats.hits} / {stats.totalTaps}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">💣</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400">{t.minesHit}</span>
                <span className="font-pixel text-[#ff0054] text-sm">{stats.minesHit}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-[#210b42] border border-[#9d4edd]/30 rounded-lg p-3 text-xs">
          <span className="text-gray-300">{t.classification}:</span>
          <span className="font-pixel text-[#ffb703] text-xs uppercase px-2 py-1 bg-[#120a2e] border border-[#ffb703]/50 rounded">
            {localizedRankTitle}
          </span>
        </div>

        <canvas ref={cardCanvasRef} className="hidden" width={600} height={400} />

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => {
              triggerHaptic('medium');
              onRestart();
            }}
            className="w-full py-3.5 px-4 bg-[#00f5d4] text-[#0b071e] font-pixel text-sm rounded-lg hover:bg-[#00f5d4]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-bold shadow-[0_0_15px_#00f5d4]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playAgain}</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareStoryOrLink}
              className="py-2.5 px-3 bg-[#ff007f] text-white font-pixel text-xs rounded-lg hover:bg-[#ff007f]/90 transition-all flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? t.linkCopied : t.challengeFriend}</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                onOpenLeaderboard();
              }}
              className="py-2.5 px-3 bg-[#210b42] border border-[#9d4edd] text-gray-200 font-pixel text-xs rounded-lg hover:border-[#00f5d4] hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 text-[#ffb703]" />
              <span>{t.leaderboardBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
