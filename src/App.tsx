import { OrbitRocketIcon, DailyStreakIcon, QuestsTargetIcon, MotionShipPreview } from "./components/ui/Icons";
import { RegistrationModal } from "./components/RegistrationModal";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Flame, Award, Sparkles, Star, Users, ShieldCheck, Share2 } from 'lucide-react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { TopNav } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { FlightLogModal } from './components/FlightLogModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { CosmeticsShopModal } from './components/CosmeticsShopModal';
import { StarsShopModal } from './components/StarsShopModal';
import { ChallengeModal } from './components/ChallengeModal';
import { DailyStreakModal } from './components/DailyStreakModal';
import { SettingsModal } from './components/SettingsModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { ProfileModal } from './components/ProfileModal';
import { AchievementsModal } from './components/AchievementsModal';
import { ReferralsModal } from './components/ReferralsModal';
import { EventBanner } from './components/EventBanner';
import { SeasonPassModal } from './components/SeasonPassModal';
import { DailyContentModal } from './components/DailyContentModal';
import { ViralModal } from './components/ViralModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { LevelUpOverlay } from './components/LevelUpOverlay';
import { OnboardingOverlay } from './components/OnboardingOverlay';
import { OfflineOverlay } from './components/OfflineOverlay';
import { GameState, RoundStats, PlayerProfile, PowerupType, LiveEventConfig } from './types/game';
import { initTelegramSDK, triggerHaptic } from './utils/telegram';
import { getInitialProfile, saveProfile, DEFAULT_SHIPS, DEFAULT_BACKDROPS, getRankTitle } from './utils/storage';
import { audioManager } from './utils/audio';
import { performanceManager } from './utils/performance';
import { flushPendingRoundsQueue, markRoundSubmitted, savePendingRound, submitRoundLogWithRetry } from './utils/sync';
import { getTranslation } from './utils/i18n';
import { calculateRoundRewards, getLevelFromXp } from './utils/progression';
import { api } from './utils/api';
import { useModalStore, ModalType } from './store/modalStore';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    const sdk = initTelegramSDK();
    return getInitialProfile(sdk.user);
  });

  const t = getTranslation(profile.lang);
  const { modals, open: openModal, close: closeModal, closeAll: closeAllModals } = useModalStore();

  const activeTab = useMemo<ModalType | null>(() => {
    if (modals.shop) return 'shop';
    if (modals.leaderboard) return 'leaderboard';
    if (modals.streak) return 'streak';
    if (modals.achievements) return 'achievements';
    if (modals.referrals) return 'referrals';
    return null;
  }, [modals]);

  const handleSelectTab = useCallback((tab: ModalType | null) => {
    if (tab === null) {
      closeAllModals();
    } else {
      if (activeTab === tab) {
        closeModal(tab);
      } else {
        closeAllModals();
        openModal(tab);
      }
    }
  }, [activeTab, closeAllModals, closeModal, openModal]);

  // Network Offline State
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      flushPendingRoundsQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live Ops Event Config State
  const [eventConfig, setEventConfig] = useState<LiveEventConfig>({
    id: 'season_1',
    titleEn: 'Season 1: Synth Horizon',
    titleRu: 'Сезон 1: Синтвайв Горизонт',
    bannerSubtitleEn: 'Earn double score during active Golden Hour Surge!',
    bannerSubtitleRu: 'Получайте x2 очков во время Золотого Часа!',
    eventType: 'season',
    badgeLabel: 'TOP 100 REWARDS',
    bannerColor: '#00F5D4',
    isGoldenHourActive: true,
    goldenHourMultiplier: 2,
    endDateISO: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const [currentScore, setCurrentScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [timeLeft, setTimeLeft] = useState(45);
  const [activePowerups, setActivePowerups] = useState<PowerupType[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [roundStats, setRoundStats] = useState<RoundStats | null>(null);

  // Level Up Celebration State
  const [newLevelCelebration, setNewLevelCelebration] = useState<number | null>(null);

  const [dailySeed, setDailySeed] = useState<string | undefined>(undefined);
  const [currentRoundId, setCurrentRoundId] = useState<string | undefined>(undefined);
  const [currentSeed, setCurrentSeed] = useState<string | undefined>(undefined);

  // Initialize Auth Session from Server
  useEffect(() => {
    api.getSession()
      .then((session) => {
        setProfile((prev) => {
          const todayIso = new Date().toISOString().split("T")[0];
          const serverStreak = Number(session.dailyClaimStreak?.streak || 0);
          const serverClaimDate = session.dailyClaimStreak?.lastClaimDate || '';
          const serverClaimedToday = Boolean(
            session.dailyClaimStreak?.claimedToday ||
            (serverClaimDate && serverClaimDate === todayIso)
          );
          const localClaimedToday = Boolean(
            prev.isDailyRewardClaimedToday ||
            (prev.lastDailyClaimDate && prev.lastDailyClaimDate === todayIso)
          );
          const effectiveClaimedToday = serverClaimedToday || localClaimedToday;
          const effectiveStreak = serverStreak > 0 ? serverStreak : prev.streakDays;
          const effectiveClaimDate = serverClaimedToday
            ? serverClaimDate || todayIso
            : (localClaimedToday ? todayIso : (serverClaimDate || prev.lastDailyClaimDate));

          const updated = {
            ...prev,
            id: String(session.profile.id),
            username: session.profile.username || prev.username,
            firstName: session.profile.firstName || prev.firstName,
            lang: (session.profile.language === 'ru' ? 'ru' : 'en') as any,
            isAdmin: session.profile.isAdmin,
            isDemo: session.profile.isDemo,
            level: session.wallet.level || prev.level,
            xp: session.wallet.xp ?? prev.xp,
            stardust: session.wallet.stardust ?? prev.stardust,
            selectedShip: session.equipped.ship || prev.selectedShip,
            selectedTrail: session.equipped.trail || prev.selectedTrail,
            selectedBackdrop: session.equipped.backdrop || prev.selectedBackdrop,
            selectedExplosion: session.equipped.explosion || prev.selectedExplosion,
            selectedFrame: session.equipped.frame || prev.selectedFrame,
            selectedTheme: session.equipped.theme || prev.selectedTheme,
            unlockedCosmetics: session.inventory?.length ? session.inventory : prev.unlockedCosmetics,
            unlockedAchievements: session.achievements || prev.unlockedAchievements,
            referralsCount: session.profile.referralsCount ?? prev.referralsCount,
            referralCode: session.profile.referralCode || prev.referralCode,
            streakDays: effectiveStreak,
            lastDailyClaimDate: effectiveClaimDate,
            isDailyRewardClaimedToday: effectiveClaimedToday,
            hasStreakInsurance: !!session.profile.hasStreakInsurance,
            hideFromLeaderboard: !!session.profile.hideFromLeaderboard,
            avatarUrl: session.profile.avatarUrl || prev.avatarUrl,
            isRegistered: Boolean(session.profile.isRegistered),
          };
          saveProfile(updated);
          if (!session.profile.isRegistered) {
            openModal('registration');
          }
          return updated;
        });
      })
      .catch((err) => {
        console.warn('Backend auth session check:', err?.message || err);
      });

    api.getAppConfig()
      .then((res) => {
        if (res && res.config) {
          setEventConfig(res.config);
        }
      })
      .catch((err) => {
        console.warn('Backend app config fetch:', err?.message || err);
      });
  }, []);

  useEffect(() => {
    audioManager.setSoundFx(profile.settings.soundFx);
    audioManager.setMusic(profile.settings.music);
    performanceManager.setManualOverride(profile.settings.particleQuality);

    flushPendingRoundsQueue();
  }, [profile.settings]);

  useEffect(() => {
    const sdk = initTelegramSDK();
    if (sdk.startParam) {
      if (sdk.startParam.startsWith('challenge_')) {
        const seed = sdk.startParam.replace('challenge_', '');
        setDailySeed(seed);
      } else if (sdk.startParam.startsWith('ref_')) {
        const inviterId = sdk.startParam.replace('ref_', '');
        if (!profile.referredBy && inviterId !== profile.id) {
          setProfile((prev) => {
            const updated = { ...prev, referredBy: inviterId, stardust: prev.stardust + 250 };
            saveProfile(updated);
            return updated;
          });
        }
      }
    }
  }, [profile.id, profile.referredBy]);

  const [startRoundError, setStartRoundError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'confirmed' | 'pending' | 'rejected'>('idle');
  const [submissionReason, setSubmissionReason] = useState<string | undefined>(undefined);

  const handleStartRound = async (isDaily: boolean = false, isDemo: boolean = false) => {
    triggerHaptic('medium');
    setStartRoundError(null);
    setSubmissionState('idle');
    setSubmissionReason(undefined);

    setCurrentScore(0);
    setCombo(0);
    setMultiplier(1);
    setTimeLeft(45);
    setActivePowerups([]);
    setIsPaused(false);
    setRoundStats(null);
    setCurrentRoundId(undefined);
    setCurrentSeed(undefined);
    setDailySeed(undefined);

    // Explicit Demo Mode handling
    if (isDemo || profile.isDemo) {
      setIsDemoMode(true);
      const demoSeed = isDaily ? `demo_daily_${Date.now()}` : `demo_norm_${Date.now()}`;
      const demoRoundId = `demo_${Date.now()}`;
      setCurrentRoundId(demoRoundId);
      setCurrentSeed(demoSeed);
      setDailySeed(isDaily ? demoSeed : undefined);
      setGameState('PLAYING');
      if (profile.settings.music) {
        audioManager.startSynthwaveLoop();
      }
      return;
    }

    // Production Rated Mode handling
    setIsDemoMode(false);
    try {
      const res = await api.startRound({ mode: isDaily ? 'daily' : 'normal' });
      if (res && res.success && res.roundId) {
        setCurrentRoundId(res.roundId);
        setCurrentSeed(res.seed);
        setDailySeed(isDaily ? res.seed : undefined);
        setGameState('PLAYING');

        if (profile.settings.music) {
          audioManager.startSynthwaveLoop();
        }
      } else {
        throw new Error((res as any)?.error || 'Failed to generate server round ID');
      }
    } catch (err: any) {
      console.warn('Start round API failed:', err);
      setCurrentRoundId(undefined);
      // DO NOT launch rated game with local fallback rnd_ timestamp
      setStartRoundError(
        profile.lang === 'ru'
          ? 'Не удалось начать рейтинговый раунд на сервере. Проверьте сеть или используйте Демо-режим.'
          : 'Failed to start server-rated session. Check connection or launch Demo Mode.'
      );
    }
  };

  const handleScoreUpdate = useCallback((score: number, currentCombo: number, currentMult: number, powerups: PowerupType[]) => {
    setCurrentScore(score);
    setCombo(currentCombo);
    setMultiplier(currentMult);
    setActivePowerups(powerups);
  }, []);

  const handleRoundComplete = useCallback((stats: RoundStats) => {
    audioManager.stopMusic();
    audioManager.playBeacon();
    triggerHaptic('success');

    // Authoritative round ID is the server round ID (currentRoundId).
    // Prioritize currentRoundId over stats.roundId
    const effectiveRoundId = (currentRoundId || stats.roundId || '').trim();

    // Handle Explicit Demo / Unrated Gameplay
    if (isDemoMode || effectiveRoundId.startsWith('demo_') || profile.isDemo) {
      const demoRoundId = effectiveRoundId.startsWith('demo_') ? effectiveRoundId : `demo_${Date.now()}`;
      const demoStats: RoundStats = { ...stats, roundId: demoRoundId };
      setRoundStats(demoStats);
      setSubmissionState('confirmed');
      setGameState('SUMMARY');
      return;
    }

    // Safety guard: rated games MUST have a valid server roundId (cannot be empty, rnd_*, or demo_*)
    if (!effectiveRoundId || effectiveRoundId.startsWith('rnd_') || effectiveRoundId.startsWith('demo_')) {
      console.warn('Cannot submit rated round without valid server roundId:', effectiveRoundId);
      const invalidStats: RoundStats = { ...stats, roundId: effectiveRoundId };
      setRoundStats(invalidStats);
      setGameState('SUMMARY');
      setSubmissionState('rejected');
      setSubmissionReason(
        profile.lang === 'ru'
          ? 'Отсутствует подтверждённый сервером идентификатор раунда. Рейтинг не начислен.'
          : 'Missing server-confirmed round ID. Rated rewards not applied.'
      );
      return;
    }

    const ratedStats: RoundStats = { ...stats, roundId: effectiveRoundId };
    setRoundStats(ratedStats);
    setGameState('SUMMARY');
    setSubmissionState('submitting');

    // Submit round to server for official anti-cheat validation and reward calculation
    api.submitRound({
      roundId: effectiveRoundId,
      clickLogs: stats.clickLogs || [],
    })
      .then((res) => {
        if (res && res.success) {
          setSubmissionState('confirmed');
          markRoundSubmitted(effectiveRoundId);

          const confirmedScore = res.confirmedScore ?? stats.score;
          const finalStats = { ...ratedStats, score: confirmedScore };
          setRoundStats(finalStats);

          setProfile((prev) => {
            const newHigh = Math.max(prev.highScore, confirmedScore);

            if (res.isLevelUp && res.level) {
              setNewLevelCelebration(res.level);
            }

            const updated: PlayerProfile = {
              ...prev,
              level: res.level || prev.level,
              xp: prev.xp + (res.earnedXp || 0),
              stardust: prev.stardust + (res.earnedStardust || 0),
              highScore: newHigh,
              dailyHighScore: finalStats.isDailySeed ? Math.max(prev.dailyHighScore, confirmedScore) : prev.dailyHighScore,
              totalRounds: prev.totalRounds + 1,
              rankTitle: (res.rankTitle as any) || getRankTitle(newHigh),
            };
            saveProfile(updated);
            return updated;
          });
        } else if (res && res.rejected) {
          console.warn('Round rejected by anti-cheat verification:', res.reason);
          setSubmissionState('rejected');
          setSubmissionReason(res.reason || 'Anti-cheat rejected round submission');
          markRoundSubmitted(effectiveRoundId);
        } else {
          throw new Error('Unconfirmed server response');
        }
      })
      .catch((err) => {
        console.warn('Round submit network/offline deferred to pending queue:', err);
        setSubmissionState('pending');
        // Save pending round ONLY if valid server round ID
        if (effectiveRoundId && !effectiveRoundId.startsWith('rnd_') && !effectiveRoundId.startsWith('demo_')) {
          savePendingRound(ratedStats);
        }
        // DO NOT locally grant XP/stardust/records on submission failure!
      });
  }, [currentRoundId, isDemoMode, profile.isDemo, profile.lang]);

  const handleRetrySubmission = async () => {
    if (!roundStats || !roundStats.roundId) return;
    setSubmissionState('submitting');
    setSubmissionReason(undefined);

    const res = await submitRoundLogWithRetry(roundStats);
    if (res.success) {
      setSubmissionState('confirmed');
      if (res.alreadySubmitted) return;

      const confirmedScore = res.confirmedScore ?? roundStats.score;
      setRoundStats((prev) => (prev ? { ...prev, score: confirmedScore } : null));

      setProfile((prev) => {
        const newHigh = Math.max(prev.highScore, confirmedScore);
        if (res.isLevelUp && res.level) {
          setNewLevelCelebration(res.level);
        }
        const updated: PlayerProfile = {
          ...prev,
          level: res.level || prev.level,
          xp: prev.xp + (res.earnedXp || 0),
          stardust: prev.stardust + (res.earnedStardust || 0),
          highScore: newHigh,
          totalRounds: prev.totalRounds + 1,
        };
        saveProfile(updated);
        return updated;
      });
    } else if (res.rejected) {
      setSubmissionState('rejected');
      setSubmissionReason(res.reason || 'Rejected by server anti-cheat');
    } else {
      setSubmissionState('pending');
    }
  };

  const handleTimeUpdate = useCallback((time: number) => {
    setTimeLeft(time);
  }, []);

  const handleClaimAchievement = async (achievementId: string, fallbackStardust: number, fallbackXp: number) => {
    try {
      const res = await api.claimAchievement(achievementId);
      if (res && res.success) {
        setProfile((prev) => {
          if (prev.unlockedAchievements.includes(achievementId)) return prev;

          const prevLvl = getLevelFromXp(prev.xp).level;
          const newXp = prev.xp + res.rewardXp;
          const newLvlInfo = getLevelFromXp(newXp);

          if (newLvlInfo.level > prevLvl) {
            setNewLevelCelebration(newLvlInfo.level);
          }

          const updated: PlayerProfile = {
            ...prev,
            level: newLvlInfo.level,
            xp: newXp,
            stardust: prev.stardust + res.rewardStardust,
            unlockedAchievements: Array.from(new Set([...prev.unlockedAchievements, achievementId])),
          };
          saveProfile(updated);
          return updated;
        });
      }
    } catch (err) {
      console.warn('Claim achievement failed:', err);
    }
  };

  const handleClaimReferralTierReward = async (tierLevel: number) => {
    try {
      const res = await api.claimReferralTier(tierLevel);
      if (res && res.success) {
        setProfile((prev) => {
          if (prev.claimedReferralTiers.includes(tierLevel)) return prev;

          const updated: PlayerProfile = {
            ...prev,
            stardust: prev.stardust + res.rewardStardust,
            claimedReferralTiers: Array.from(new Set([...prev.claimedReferralTiers, tierLevel])),
          };

          if (res.rewardShipId && !updated.unlockedShips.includes(res.rewardShipId)) {
            updated.unlockedShips = [...updated.unlockedShips, res.rewardShipId];
            updated.unlockedCosmetics = Array.from(new Set([...updated.unlockedCosmetics, res.rewardShipId]));
          }

          saveProfile(updated);
          return updated;
        });
      }
    } catch (err) {
      console.warn('Claim referral tier failed:', err);
    }
  };

  const handleClaimDaily = async () => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (profile.isDailyRewardClaimedToday || profile.lastDailyClaimDate === todayStr) {
      return;
    }

    try {
      const res = await api.claimDaily();
      if (res && res.success) {
        setProfile((prev) => {
          const updated = {
            ...prev,
            stardust: prev.stardust + res.rewardStardust,
            streakDays: res.streak,
            hasStreakInsurance: res.hasStreakInsurance ?? prev.hasStreakInsurance,
            lastDailyClaimDate: todayStr,
            isDailyRewardClaimedToday: true,
          };
          saveProfile(updated);
          return updated;
        });
      }
    } catch (err: any) {
      console.warn('Daily claim network/API call:', err);
      if (err?.message === 'ALREADY_CLAIMED' || err?.status === 400) {
        setProfile((prev) => {
          const updated = {
            ...prev,
            lastDailyClaimDate: todayStr,
            isDailyRewardClaimedToday: true,
          };
          saveProfile(updated);
          return updated;
        });
        return;
      }

      // Offline / client fallback mode: guarantee single claim per day with reward
      setProfile((prev) => {
        if (prev.isDailyRewardClaimedToday || prev.lastDailyClaimDate === todayStr) {
          return prev;
        }

        const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        let newStreak = 1;
        let consumedInsurance = false;

        if (prev.lastDailyClaimDate === yesterdayDate) {
          newStreak = Math.min(30, (prev.streakDays || 0) + 1);
        } else if (prev.lastDailyClaimDate && prev.lastDailyClaimDate < yesterdayDate) {
          if (prev.hasStreakInsurance) {
            newStreak = Math.min(30, (prev.streakDays || 0) + 1);
            consumedInsurance = true;
          } else {
            newStreak = 1;
          }
        }

        let rewardStardust = 20 + newStreak * 10;
        if (newStreak % 5 === 0) rewardStardust += 150;
        if (newStreak === 30) rewardStardust = 2000;

        const updated = {
          ...prev,
          stardust: prev.stardust + rewardStardust,
          streakDays: newStreak,
          hasStreakInsurance: consumedInsurance ? false : prev.hasStreakInsurance,
          lastDailyClaimDate: todayStr,
          isDailyRewardClaimedToday: true,
        };
        saveProfile(updated);
        return updated;
      });
    }
  };

  const handleStarsPaymentSuccess = async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const session = await api.getSession();
        if (session && session.wallet) {
          setProfile((prev) => {
            const updated = {
              ...prev,
              stardust: session.wallet.stardust ?? prev.stardust,
              unlockedCosmetics: session.inventory?.length ? session.inventory : prev.unlockedCosmetics,
              unlockedShips: session.inventory?.filter((id) => id.startsWith('ship_')) || prev.unlockedShips,
              hasStreakInsurance: session.profile.hasStreakInsurance ?? prev.hasStreakInsurance,
            };
            saveProfile(updated);
            return updated;
          });
          break;
        }
      } catch (err) {
        console.warn('Session polling error:', err);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  const currentShip = DEFAULT_SHIPS.find((s) => s.id === profile.selectedShip) || DEFAULT_SHIPS[0];
  const currentBackdrop = DEFAULT_BACKDROPS.find((b) => b.id === profile.selectedBackdrop) || DEFAULT_BACKDROPS[0];
  const shipName = profile.lang === 'ru' ? currentShip.nameRu : currentShip.name;

  return (
    <div className="relative w-screen h-app-screen bg-[#0b071e] text-white overflow-hidden flex flex-col font-mono-tech select-none">
      {/* Offline Connectivity Screen */}
      <OfflineOverlay
        isOffline={isOffline}
        lang={profile.lang}
        onRetry={() => {
          if (navigator.onLine) {
            setIsOffline(false);
            flushPendingRoundsQueue();
          }
        }}
      />

      {gameState === 'MENU' && (
        <TopNav
          profile={profile}
          onOpenProfile={() => openModal('profile')}
          onOpenShop={() => openModal('shop')}
          onOpenStarsShop={() => openModal('starsShop')}
          onOpenSettings={() => openModal('settings')}
          onOpenAdminPanel={() => openModal('adminDashboard')}
        />
      )}

      <div className="relative flex-1 w-full h-full min-h-0 overflow-hidden">
        <GameCanvas
          isPlaying={gameState === 'PLAYING'}
          isPaused={isPaused}
          shipColor={currentShip.color}
          trailType={currentShip.trailType}
          backdropId={currentBackdrop.id}
          crtIntensity={profile.settings.crtIntensity}
          reduceMotion={profile.settings.reduceMotion}
          dailySeed={dailySeed}
          roundId={currentRoundId}
          isDemo={isDemoMode}
          seed={currentSeed}
          onPauseChange={setIsPaused}
          onScoreUpdate={handleScoreUpdate}
          onRoundComplete={handleRoundComplete}
          onTimeUpdate={handleTimeUpdate}
        />

        {gameState === 'PLAYING' && (
          <HUD
            score={currentScore}
            combo={combo}
            multiplier={multiplier}
            timeLeft={timeLeft}
            activePowerups={activePowerups}
            isPaused={isPaused}
            soundEnabled={profile.settings.soundFx}
            lang={profile.lang}
            onPauseToggle={() => setIsPaused((prev) => !prev)}
            onSoundToggle={() => {
              const newSound = !profile.settings.soundFx;
              setProfile((prev) => {
                const u = { ...prev, settings: { ...prev.settings, soundFx: newSound } };
                saveProfile(u);
                return u;
              });
            }}
          />
        )}

        {gameState === 'MENU' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-black/45 backdrop-blur-[2px] overflow-y-auto max-w-sm mx-auto w-full">
            {/* Top Branding & Event Banner */}
            <div className="flex flex-col items-center gap-1 sm:gap-1.5 animate-fade-in text-center w-full shrink-0">
              <div className="px-2.5 py-0.5 sm:py-1 rounded-full bg-[#9d4edd]/20 border border-[#9d4edd] text-[#00f5d4] text-[9px] sm:text-[10px] font-pixel tracking-widest uppercase shadow-[0_0_10px_rgba(157,78,221,0.3)]">
                {t.tagline}
              </div>
              <h1 className="font-pixel text-2xl sm:text-3xl text-white text-glow-cyan font-bold tracking-tight">
                {t.appTitle}
              </h1>

              <div className="w-full mt-0.5 sm:mt-1">
                <EventBanner
                  eventConfig={eventConfig}
                  lang={profile.lang}
                  onBannerClick={() => openModal('seasonPass')}
                />
              </div>
            </div>

            {/* Selected Ship Box (Interactive - Tapping opens Cosmetics Shop) */}
            <div
              onClick={() => openModal('shop')}
              className="flex flex-col items-center cursor-pointer group my-1 sm:my-auto active:scale-95 transition-transform"
            >
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#120a2e]/90 border-2 border-[#00f5d4] flex items-center justify-center shadow-[0_0_20px_rgba(0,245,212,0.4)] group-hover:shadow-[0_0_30px_rgba(0,245,212,0.8)] group-hover:border-white transition-all overflow-hidden p-1">
                <MotionShipPreview shipId={profile.selectedShip} color={currentShip.color || "#00f5d4"} accentColor={currentShip.accentColor || "#ff007f"} size={90} />
              </div>
              <span className="font-pixel text-[10px] sm:text-[11px] text-[#00f5d4] tracking-wide mt-1">
                {t.equipped}: {shipName.toUpperCase()}
              </span>
              <span className="font-pixel text-[8px] text-gray-400 group-hover:text-white transition-colors mt-0.5">
                {profile.lang === 'ru' ? '► НАЖМИ ДЛЯ СМЕНЫ' : '► TAP TO CUSTOMIZE'}
              </span>
            </div>

            {/* Launch Round Buttons & Error Alert */}
            <div className="w-full max-w-sm flex flex-col gap-2 shrink-0 mb-1">
              {startRoundError && (
                <div className="w-full p-2.5 bg-red-950/90 border border-red-500 rounded-xl text-red-200 text-xs text-center flex flex-col gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-shake">
                  <span>{startRoundError}</span>
                  <button
                    onClick={() => {
                      setStartRoundError(null);
                      handleStartRound(false, true);
                    }}
                    className="py-1.5 px-3 bg-purple-900 border border-purple-400 text-purple-200 font-pixel text-[10px] rounded-lg hover:bg-purple-800 transition-all font-bold"
                  >
                    {profile.lang === 'ru' ? '🎮 ИГРАТЬ В ДЕМО-РЕЖИМЕ (БЕЗ РЕЙТИНГА)' : '🎮 PLAY DEMO MODE (UNRATED)'}
                  </button>
                </div>
              )}

              <button
                onClick={() => handleStartRound(false, false)}
                className="w-full py-3.5 sm:py-4 bg-[#00f5d4] text-[#0b071e] font-pixel text-xs sm:text-sm rounded-xl font-bold hover:bg-[#00f5d4]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(0,245,212,0.6)] border border-[#00f5d4] group"
              >
                <OrbitRocketIcon size={22} color="#0b071e" glowColor="#00f5d4" className="group-hover:scale-110 transition-transform" />
                <span>{t.startRound}</span>
              </button>

              <button
                onClick={() => handleStartRound(true, false)}
                className="w-full py-2.5 bg-[#1f0a38] border-2 border-[#ff007f] text-white font-pixel text-[9px] sm:text-[10px] rounded-xl hover:border-[#00f5d4] hover:shadow-[0_0_20px_rgba(255,0,127,0.6)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(255,0,127,0.4)]"
              >
                <DailyStreakIcon size={18} color="#ff007f" glowColor="#ff007f" />
                <span>{t.dailyChallenge}</span>
              </button>

              <button
                onClick={() => handleStartRound(false, true)}
                className="w-full py-2 bg-purple-950/80 border border-purple-500/50 text-purple-300 font-pixel text-[9px] sm:text-[10px] rounded-xl hover:bg-purple-900 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <span>{profile.lang === 'ru' ? '🎮 ДЕМО-РЕЖИМ (ТРЕНИРОВКА)' : '🎮 DEMO MODE (PRACTICE)'}</span>
              </button>

              <button
                onClick={() => openModal('dailyContent')}
                className="w-full py-2.5 bg-slate-900 border border-cyan-500/40 text-cyan-400 font-pixel text-[9px] sm:text-[10px] rounded-xl hover:bg-cyan-950 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>{profile.lang === 'ru' ? 'ЕЖЕДНЕВНЫЕ КВЕСТЫ' : 'DAILY QUESTS & HUB'}</span>
              </button>

              <button
                onClick={() => openModal('viral')}
                className="w-full py-2.5 bg-[#2b083d] border border-[#ff007f]/40 text-[#ff007f] font-pixel text-[9px] sm:text-[10px] rounded-xl hover:bg-[#380b52] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(255,0,127,0.2)]"
              >
                <Share2 className="w-3.5 h-3.5 text-[#ff007f]" />
                <span>{profile.lang === 'ru' ? 'ВИРУСНЫЙ ШТАБ (ЦЕЛИ И ВЫЗОВЫ)' : 'VIRAL HUB & CHALLENGES'}</span>
              </button>
            </div>
          </div>
        )}

        {gameState === 'SUMMARY' && roundStats && (
          <FlightLogModal
            stats={roundStats}
            profile={profile}
            isDemo={isDemoMode || !!roundStats.roundId?.startsWith('demo_')}
            submissionState={submissionState}
            submissionReason={submissionReason}
            onRetrySubmission={handleRetrySubmission}
            onRestart={() => handleStartRound(false, isDemoMode)}
            onOpenLeaderboard={() => openModal('leaderboard')}
            onHome={() => setGameState('MENU')}
          />
        )}
      </div>

      {gameState === 'MENU' && (
        <BottomNav
          profile={profile}
          activeModal={activeTab}
          onSelectTab={handleSelectTab}
        />
      )}

      {/* Level Up Celebration Banner */}
      {newLevelCelebration && (
        <LevelUpOverlay
          newLevel={newLevelCelebration}
          lang={profile.lang}
          onDismiss={() => setNewLevelCelebration(null)}
        />
      )}

      {/* Navigation Modals */}
      {modals.registration && (
        <RegistrationModal
          profile={profile}
          isOpen={modals.registration}
          onClose={() => closeModal('registration')}
          onRegistered={(updatedUsername, avatarUrl) => {
            setProfile((prev) => {
              const updated = {
                ...prev,
                username: updatedUsername,
                avatarUrl: avatarUrl || prev.avatarUrl,
                isRegistered: true,
              };
              saveProfile(updated);
              return updated;
            });
            closeModal('registration');
          }}
        />
      )}
      {modals.profile && (
        <ProfileModal
          profile={profile}
          onClose={() => closeModal('profile')}
        />
      )}

      {modals.leaderboard && (
        <LeaderboardModal
          currentUserId={profile.id}
          lang={profile.lang}
          onClose={() => closeModal('leaderboard')}
        />
      )}

      {modals.adminDashboard && (
        <AdminDashboardModal
          currentConfig={eventConfig}
          onSaveConfig={(newConfig) => setEventConfig(newConfig)}
          onClose={() => closeModal('adminDashboard')}
        />
      )}

      {modals.shop && (
        <CosmeticsShopModal
          profile={profile}
          onUpdateProfile={(u) => {
            setProfile(u);
            saveProfile(u);
          }}
          onClose={() => closeModal('shop')}
        />
      )}

      {modals.starsShop && (
        <StarsShopModal
          profile={profile}
          onPaymentSuccess={handleStarsPaymentSuccess}
          onClose={() => closeModal('starsShop')}
        />
      )}

      {modals.achievements && (
        <AchievementsModal
          profile={profile}
          onClaimAchievement={handleClaimAchievement}
          onClose={() => closeModal('achievements')}
        />
      )}

      {modals.referrals && (
        <ReferralsModal
          profile={profile}
          onClaimTierReward={handleClaimReferralTierReward}
          onClose={() => closeModal('referrals')}
        />
      )}

      {modals.challenge && (
        <ChallengeModal
          score={profile.highScore}
          lang={profile.lang}
          onClose={() => closeModal('challenge')}
        />
      )}

      {modals.streak && (
        <DailyStreakModal
          profile={profile}
          onClaimReward={handleClaimDaily}
          onClose={() => closeModal('streak')}
        />
      )}

      {modals.settings && (
        <SettingsModal
          profile={profile}
          onUpdateSettings={(s) => {
            const u = { ...profile, settings: s };
            setProfile(u);
            saveProfile(u);
          }}
          onUpdateNotifications={(enabled) => {
            const u = { ...profile, notificationsEnabled: enabled };
            setProfile(u);
            saveProfile(u);
          }}
          onUpdateLang={(lang) => {
            const u = { ...profile, lang };
            setProfile(u);
            saveProfile(u);
          }}
          onOpenPrivacyPolicy={() => openModal('privacy')}
          onClose={() => closeModal('settings')}
        />
      )}

      {modals.privacy && (
        <PrivacyPolicyModal
          lang={profile.lang}
          onClose={() => closeModal('privacy')}
          onRequestDataDeletion={() => {
            if (window.confirm(profile.lang === 'ru' ? 'Вы уверены, что хотите сбросить свой локальный профиль?' : 'Are you sure you want to reset your profile data?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
        />
      )}

      {modals.seasonPass && (
        <SeasonPassModal
          isOpen={modals.seasonPass}
          onClose={() => closeModal('seasonPass')}
          onOpenStarsShop={() => {
            closeModal('seasonPass');
            openModal('starsShop');
          }}
        />
      )}

      {modals.dailyContent && (
        <DailyContentModal
          isOpen={modals.dailyContent}
          lang={profile.lang}
          onClose={() => closeModal('dailyContent')}
        />
      )}

      {modals.viral && (
        <ViralModal
          isOpen={modals.viral}
          lang={profile.lang}
          onClose={() => closeModal('viral')}
          lastScore={roundStats?.score || 1000}
          lastCombo={roundStats?.maxCombo || 5}
          lastSeed={typeof roundStats?.dailySeed === 'string' ? parseInt(roundStats.dailySeed, 10) || Date.now() : Date.now()}
        />
      )}

      {!profile.hasCompletedOnboarding && (
        <OnboardingOverlay
          lang={profile.lang}
          onComplete={() => {
            const updated = { ...profile, hasCompletedOnboarding: true };
            setProfile(updated);
            saveProfile(updated);
          }}
        />
      )}
    </div>
  );
}
