import { Achievement, RoundStats } from '../types/game';

/**
 * Leveling Formula (1–50)
 * XP required for level N: 150 * (N ^ 1.35)
 */
export const getXpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  return Math.floor(180 * Math.pow(level - 1, 1.32));
};

export const getLevelFromXp = (totalXp: number): { level: number; currentXp: number; nextLevelXp: number; progressPercent: number } => {
  let level = 1;
  while (level < 50 && totalXp >= getXpForLevel(level + 1)) {
    level++;
  }

  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(Math.min(50, level + 1));
  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progressPercent = level >= 50 ? 100 : Math.min(100, Math.floor((xpInCurrentLevel / (xpNeededForNext || 1)) * 100));

  return {
    level,
    currentXp: xpInCurrentLevel,
    nextLevelXp: xpNeededForNext,
    progressPercent,
  };
};

/**
 * Calculates Stardust and XP rewards from a finished round
 */
export const calculateRoundRewards = (stats: RoundStats): { earnedXp: number; earnedStardust: number } => {
  // Base XP = 10% of round score + accuracy bonus
  const baseXp = Math.floor(stats.score * 0.1) + Math.floor(stats.accuracy * 2);
  // Base Stardust = 5% of score + max combo bonus
  const baseStardust = Math.floor(stats.score * 0.05) + stats.maxCombo * 3 + stats.goldenBeaconsHit * 15;

  return {
    earnedXp: Math.max(25, baseXp),
    earnedStardust: Math.max(10, baseStardust),
  };
};

import { ACHIEVEMENTS_LIST } from '../shared/achievements';
import { PlayerProfile } from '../types/game';
export { ACHIEVEMENTS_LIST };

export interface AchievementProgress {
  currentValue: number;
  targetValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
  canClaim: boolean;
  progressPercent: number;
}

export function getAchievementProgress(ach: Achievement, profile: PlayerProfile): AchievementProgress {
  const isClaimed = profile.unlockedAchievements?.includes(ach.id) ?? false;
  let currentValue = 0;

  switch (ach.id) {
    case 'first_blood':
    case 'rounds_5':
    case 'rounds_20':
    case 'rounds_50':
      currentValue = profile.totalRounds || 0;
      break;
    case 'score_5k':
    case 'score_10k':
    case 'score_15k':
      currentValue = profile.highScore || 0;
      break;
    case 'combo_5':
    case 'combo_12':
    case 'combo_20':
      currentValue = profile.maxCombo || 0;
      break;
    case 'tap_100':
    case 'tap_500':
    case 'comet_hunter':
      currentValue = profile.totalTargetsHit || 0;
      break;
    case 'beacon_5':
    case 'beacon_25':
      currentValue = profile.goldenBeaconsHit || 0;
      break;
    case 'accuracy_80':
    case 'accuracy_95':
      currentValue = profile.bestAccuracy || 0;
      break;
    case 'level_5':
    case 'level_15':
    case 'level_30':
      currentValue = profile.level || 1;
      break;
    case 'ship_collector':
      currentValue = profile.unlockedShips?.length || 1;
      break;
    case 'backdrop_collector':
      currentValue = profile.unlockedBackdrops?.length || 1;
      break;
    case 'streak_3':
    case 'streak_7':
    case 'streak_14':
    case 'streak_30':
      currentValue = profile.streakDays || 0;
      break;
    case 'daily_seed_play':
      currentValue = (profile.dailyHighScore || 0) > 0 ? 1 : 0;
      break;
    case 'friend_challenge':
      currentValue = (profile.referralsCount || 0) > 0 ? 1 : 0;
      break;
    case 'mine_dodge':
    case 'supernova_user':
      currentValue = (profile.totalRounds || 0) >= 1 ? 1 : 0;
      break;
    default:
      currentValue = profile.totalRounds || 0;
      break;
  }

  const isCompleted = currentValue >= ach.targetValue;
  const canClaim = isCompleted && !isClaimed;
  const progressPercent = Math.min(100, Math.floor((currentValue / (ach.targetValue || 1)) * 100));

  return {
    currentValue,
    targetValue: ach.targetValue,
    isCompleted,
    isClaimed,
    canClaim,
    progressPercent,
  };
}


