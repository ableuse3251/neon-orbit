import { OrbitRocketIcon, DailyStreakIcon, QuestsTargetIcon, MotionShipPreview } from "./components/ui/Icons";
import { RegistrationModal } from "./components/RegistrationModal";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Flame, Award, Sparkles, Star, Users, ShieldCheck, Share2 } from 'lucide-react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { TopNav } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { MainGameMenu } from './components/MainGameMenu';
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
import { trackEvent } from './utils/analytics';
import { calculateRoundRewards, getLevelFromXp } from './utils/progression';
import { api, checkConnectivity } from './utils/api';
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
      audioManager.playNavTab('orbit');
      audioManager.setMenuScene('orbit');
      closeAllModals();
    } else {
      if (activeTab === tab) {
        audioManager.playModalClose();
        audioManager.setMenuScene('orbit');
        closeModal(tab);
      } else {
        audioManager.playNavTab(tab);
        audioManager.setMenuScene(tab);
        closeAllModals();
        openModal(tab);
      }
    }
  }, [activeTab, closeAllModals, closeModal, openModal]);

  // Network Offline State
  const [isOffline, setIsOffline] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    let unmounted = false;

    // Proactively verify connection if browser reports offline (avoids false-positive in WebView/VPN)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      checkConnectivity().then((alive) => {
        if (!unmounted && !alive) {
          setIsOffline(true);
        }
      });
    }

    const handleOnline = () => {
      setIsOffline(false);
      flushPendingRoundsQueue();
    };

    const handleOffline = () => {
      // Don't immediately lock out user; verify if server is actually unreachable
      checkConnectivity().then((alive) => {
        if (!unmounted && !alive) {
          setIsOffline(true);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unmounted = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetryConnection = async () => {
    setIsReconnecting(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setIsOffline(false);
        flushPendingRoundsQueue();
        triggerHaptic('success');
        return;
      }
      const alive = await checkConnectivity();
      if (alive) {
        setIsOffline(false);
        flushPendingRoundsQueue();
        triggerHaptic('success');
      } else {
        triggerHaptic('error');
      }
    } catch {
      triggerHaptic('error');
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleContinueOffline = () => {
    setIsOffline(false);
    setIsDemoMode(true);
  };

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
    trackEvent('app_open');
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

  // Synthwave Background Music Lifecycle
  useEffect(() => {
    if (profile.settings.music) {
      audioManager.startSynthwaveLoop();
    } else {
      audioManager.stopMusic();
    }
  }, [gameState, profile.settings.music]);

  // Unlock AudioContext and ensure background MP3 playback starts on first user touch/click
  useEffect(() => {
    const handleFirstInteraction = () => {
      audioManager.unlockAudio();
      if (profile.settings.music) {
        audioManager.startSynthwaveLoop();
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [profile.settings.music]);

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
      const demoSeed = isDaily
        ? `demo_daily_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        : `demo_norm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const demoRoundId = `demo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
        trackEvent('round_start', { mode: isDaily ? 'daily' : 'normal' });

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
    audioManager.playBeacon();
    triggerHaptic('success');
    trackEvent('round_complete', { score: stats.score });

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
    <div className="relative w-full max-w-full h-full h-app-screen bg-[#0b071e] text-white overflow-hidden flex flex-col font-mono-tech select-none">
      {/* Offline Connectivity Screen */}
      <OfflineOverlay
        isOffline={isOffline}
        lang={profile.lang}
        isReconnecting={isReconnecting}
        onRetry={handleRetryConnection}
        onContinueOffline={handleContinueOffline}
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
          shipId={currentShip.id}
          shipColor={currentShip.color}
          shipAccentColor={currentShip.accentColor}
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
          <MainGameMenu
            profile={profile}
            eventConfig={eventConfig}
            currentShip={currentShip}
            startRoundError={startRoundError}
            onClearStartRoundError={() => setStartRoundError(null)}
            onStartRound={handleStartRound}
            onOpenModal={openModal}
          />
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
          profile={profile}
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
