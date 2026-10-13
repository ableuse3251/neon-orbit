import { z } from 'zod';

// 1. Game Routes Schemas
export const startRoundSchema = z.object({
  mode: z.enum(['normal', 'daily', 'challenge']).default('normal'),
  seed: z.string().trim().max(100).optional(),
});

export const clickLogSchema = z.object({
  timestampMs: z.number().nonnegative().default(0),
  xPct: z.number().min(0).max(100).default(50),
  yPct: z.number().min(0).max(100).default(50),
  type: z.enum(['hit', 'miss']).default('miss'),
  targetId: z.string().max(100).optional(),
  targetType: z.string().max(50).optional(),
  scoreGained: z.number().optional(),
  // Legacy / UI compatibility fields
  timestamp: z.number().optional(),
  hit: z.boolean().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const submitRoundSchema = z.object({
  roundId: z.string().trim().min(1, 'roundId is required').max(100),
  clickLogs: z.array(clickLogSchema).max(1200, 'Too many tap logs in round').default([]),
  chatId: z.union([z.string().max(50), z.number()]).optional(),
});

// 2. Stars Invoicing Schema
export const createInvoiceSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required').max(100),
});

// 3. Economy & Shop Schemas
export const buyCosmeticSchema = z.object({
  itemId: z.string().trim().min(1, 'itemId is required').max(100),
});

export const equipCosmeticSchema = z.object({
  category: z.enum(['ship', 'trail', 'backdrop', 'explosion', 'frame', 'theme']),
  itemId: z.string().trim().min(1, 'itemId is required').max(100),
});

export const claimAchievementSchema = z.object({
  achievementId: z.string().trim().min(1, 'achievementId is required').max(100),
});

export const claimReferralTierSchema = z.object({
  tierLevel: z.coerce.number().int().min(1).max(50),
});

// 4. User Settings & Privacy Schemas
export const updateUserSettingsSchema = z.object({
  hideFromLeaderboard: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});

export const adminPlayerActionSchema = z.object({
  userId: z.union([z.string().trim().min(1), z.number()]),
  action: z.enum(['ban', 'unban', 'shadow_ban', 'unshadow_ban', 'reset_score']),
});

export const updatePlayerStatusSchema = z.object({
  isBanned: z.boolean().optional(),
  shadowBanned: z.boolean().optional(),
  resetScore: z.boolean().optional(),
  addStardust: z.number().int().optional(),
});

export const updateLiveConfigSchema = z.object({
  config: z.object({
    id: z.string().max(100),
    titleEn: z.string().max(200),
    titleRu: z.string().max(200),
    bannerSubtitleEn: z.string().max(300).optional(),
    bannerSubtitleRu: z.string().max(300).optional(),
    eventType: z.string().max(50),
    badgeLabel: z.string().max(100).optional(),
    bannerColor: z.string().max(50).optional(),
    isGoldenHourActive: z.boolean().optional(),
    goldenHourMultiplier: z.number().min(1).max(10).optional(),
    endDateISO: z.string().max(50).optional(),
  }),
});

export const broadcastMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty').max(4000, 'Message cannot exceed 4000 characters'),
  targetGroup: z.enum(['all', 'premium', 'active_today']).default('all'),
  includePlayButton: z.boolean().default(true),
});

export const refundPaymentSchema = z.object({
  chargeId: z.string().trim().min(1, 'chargeId is required').max(255),
  userId: z.union([z.string(), z.number()]),
});

// 5. Viral & Challenges Schemas (F18)
export const createChallengeSchema = z.object({
  score: z.number().int().nonnegative().max(1000000000).default(0),
  combo: z.number().int().min(1).max(100).default(1),
  seed: z.union([z.string().max(100), z.number()]).optional(),
});

export const viralChatContributionSchema = z.object({
  chatId: z.union([z.string().max(50), z.number()]),
  roundId: z.string().trim().min(1).max(100),
});

// 6. Notifications & Preferences Schema (F18)
export const notificationPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  quietStart: z.number().int().min(0).max(23).optional(),
  quietEnd: z.number().int().min(0).max(23).optional(),
  timezone: z.string().trim().max(100).optional(),
});

// 7. Analytics Batch Ingestion Schema (F18)
export const analyticsBatchSchema = z.object({
  events: z.array(
    z.object({
      name: z.string().trim().min(1).max(64),
      timestamp: z.number().optional(),
      props: z.record(z.string(), z.any()).optional(),
    })
  ).min(1).max(50),
});

