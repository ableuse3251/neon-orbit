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
export { ACHIEVEMENTS_LIST };

