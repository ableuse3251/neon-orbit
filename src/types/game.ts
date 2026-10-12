export type TargetType = 'asteroid' | 'comet' | 'golden_beacon' | 'mine' | 'magnet' | 'double_beacon' | 'black_hole' | 'boss_meteor';
export type PowerupType = 'freeze' | 'supernova' | 'shield' | 'slow_time' | 'magnet_field';
export type GameMode = 'classic' | 'blitz' | 'survival' | 'rhythm' | 'daily' | 'challenge';
export type GameState = 'MENU' | 'PLAYING' | 'SUMMARY';
export type Language = 'en' | 'ru';

export type CosmeticCategory = 'ship' | 'trail' | 'backdrop' | 'explosion' | 'frame' | 'theme' | 'title';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Target {
  id: string;
  type: TargetType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  vRot: number;
  points: number;
  maxHp: number;
  hp: number;
  spawnTime: number;
  lifespan: number;
  pulsePhase: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  life: number;
}

import { ClickLog } from '../shared/targetGenerator';
export type { ClickLog };

export interface RoundStats {
  roundId: string;
  score: number;
  rawScore: number;
  totalTaps: number;
  hits: number;
  misses: number;
  maxCombo: number;
  accuracy: number;
  minesHit: number;
  goldenBeaconsHit: number;
  powerupsUsed: PowerupType[];
  duration: number;
  isDailySeed: boolean;
  dailySeed?: string;
  clickLogs: ClickLog[];
}

export interface Achievement {
  id: string;
  titleEn: string;
  titleRu: string;
  descEn: string;
  descRu: string;
  icon: string;
  category: 'combat' | 'combo' | 'veteran' | 'streak';
  targetValue: number;
  rewardStardust: number;
  rewardXp: number;
}

export interface LiveEventConfig {
  id: string;
  titleEn: string;
  titleRu: string;
  bannerSubtitleEn: string;
  bannerSubtitleRu: string;
  eventType: 'season' | 'golden_hour' | 'holiday_event';
  badgeLabel: string;
  bannerColor: string;
  isGoldenHourActive: boolean;
  goldenHourMultiplier: number;
  endDateISO: string;
}

export interface PlayerAdminView {
  id: string;
  username: string;
  firstName: string;
  highScore: number;
  level: number;
  maxCps: number;
  isShadowBanned: boolean;
  isBanned?: boolean;
  stardust?: number;
  flaggedReason?: string;
  totalRounds: number;
  totalStarsSpent: number;
  lastActiveISO: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  username: string;
  itemId: string;
  amountStars: number;
  chargeId: string;
  status: 'COMPLETED' | 'REFUNDED';
  timestampISO: string;
}

export interface AdminMetrics {
  dau: number;
  wau: number;
  retentionD1: number;
  retentionD7: number;
  retentionD30: number;
  kFactor: number;
  totalStarsRevenue: number;
  totalRoundsPlayed: number;
  avgRoundsPerSession: number;
  firstTapWithin5sRate: number;
  conversionToPaying: number;
  arpdau: number;
  flaggedAutoclickersCount: number;
  funnel: {
    appOpen: number;
    firstTap: number;
    firstRound: number;
    secondRound: number;
    inviteSent: number;
  };
}

export interface PlayerProfile {
  id: string;
  username: string;
  firstName: string;
  level: number;
  xp: number;
  stardust: number;
  highScore: number;
  dailyHighScore: number;
  totalRounds: number;
  rankTitle: 'Pilot' | 'Commander' | 'Fleet Admiral';
  isAdmin?: boolean;
  isDemo?: boolean;
  isShadowBanned?: boolean;
  hideFromLeaderboard?: boolean;

  selectedShip: string;
  selectedTrail: string;
  selectedBackdrop: string;
  selectedExplosion: string;
  selectedFrame: string;
  selectedTheme: string;

  unlockedShips: string[];
  unlockedBackdrops: string[];
  unlockedCosmetics: string[];
  unlockedAchievements: string[];

  referralCode: string;
  referredBy?: string;
  referralsCount: number;
  claimedReferralTiers: number[];
  notificationsEnabled: boolean;
  hasCompletedOnboarding: boolean;

  hasStreakInsurance: boolean;
  starsBalance: number;
  streakDays: number;
  lastLoginDate: string;
  lang: Language;
  settings: {
    soundFx: boolean;
    music: boolean;
    volumeFx: number; // 0.0 - 1.0
    volumeMusic: number; // 0.0 - 1.0
    hapticsEnabled: boolean;
    crtIntensity: 'off' | 'low' | 'high';
    particleQuality: 'low' | 'auto' | 'high';
    reduceMotion?: boolean;
    hideFromLeaderboard?: boolean;
  };
}

export interface CosmeticItem {
  id: string;
  category: CosmeticCategory;
  rarity: Rarity;
  nameEn: string;
  nameRu: string;
  descEn: string;
  descRu: string;
  priceStardust: number;
  previewColor?: string;
  accentColor?: string;
  iconSymbol?: string;
}

export interface StarsStoreItem {
  id: string;
  titleEn: string;
  titleRu: string;
  descEn: string;
  descRu: string;
  priceStars: number;
  icon: string;
  rewardStardustBonus?: number;
  rewardShipId?: string;
  rewardBackdropId?: string;
  isStreakInsurance?: boolean;
}

export interface ReferralTier {
  level: number;
  requiredInvites: number;
  reqCount?: number;
  rewardStardust: number;
  rewardShipId?: string;
  titleEn: string;
  titleRu: string;
}

export interface ShipSkin {
  id: string;
  name: string;
  nameRu: string;
  description?: string;
  priceStars?: number;
  priceStardust?: number;
  color: string;
  accentColor: string;
  trailType: 'plasma' | 'rainbow' | 'gold' | 'crimson';
  iconSvg: string;
  unlocked: boolean;
}

export interface BackdropSkin {
  id: string;
  name: string;
  nameRu: string;
  description?: string;
  priceStars?: number;
  priceStardust?: number;
  primaryColor?: string;
  secondaryColor?: string;
  gridColor?: string;
  theme?: string;
  previewGradient?: string;
  unlocked: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  firstName: string;
  score: number;
  rankTitle: string;
  isCurrentUser?: boolean;
}

export interface ChallengeData {
  id: string;
  challengerName: string;
  challengerScore: number;
  targetSeed: string;
  expiresInSeconds: number;
}
