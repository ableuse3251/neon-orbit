import { getTelegramApp } from './telegram';
import { ClickLog } from '../shared/targetGenerator';
import { LiveEventConfig, AdminMetrics, PlayerAdminView, PaymentRecord } from '../types/game';

export interface UserSessionData {
  profile: {
    id: number;
    username: string;
    firstName: string;
    language: string;
    isPremium: boolean;
    isAdmin: boolean;
    isDemo: boolean;
    referralCode: string;
    referralsCount: number;
    hasStreakInsurance?: boolean;
    hideFromLeaderboard?: boolean;
  };
  wallet: {
    stardust: number;
    xp: number;
    level: number;
  };
  equipped: {
    ship: string;
    trail: string;
    backdrop: string;
    explosion: string;
    frame: string;
    theme: string;
  };
  inventory: string[];
  achievements: string[];
  dailyClaimStreak: {
    streak: number;
    lastClaimDate: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username?: string;
  firstName: string;
  score: number;
  rankTitle: string;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  success: boolean;
  scope: 'global' | 'daily' | 'friends' | 'chat';
  seasonTitle: string;
  entries: LeaderboardEntry[];
  currentUser?: {
    rank: number | null;
    score: number;
    rankTitle: string;
    hideFromLeaderboard: boolean;
  };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const telegramApp = getTelegramApp();
  const initData = telegramApp?.initData || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (initData) {
    headers['Authorization'] = `tma ${initData}`;
  }

  const url = endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new ApiError('Unauthorized: Telegram initData verification failed', 401);
  }

  if (response.status === 403) {
    throw new ApiError('Forbidden: Access denied. Admin authorization required.', 403);
  }

  if (!response.ok) {
    let errorMsg = `API request failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.error || errJson.message) {
        errorMsg = errJson.error || errJson.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new ApiError(errorMsg, response.status);
  }

  return response.json() as Promise<T>;
}

export const api = {
  async getSession(): Promise<UserSessionData> {
    return fetchApi<UserSessionData>('/api/auth/session');
  },

  async getAppConfig(): Promise<{ config: LiveEventConfig }> {
    return fetchApi<{ config: LiveEventConfig }>('/api/config');
  },

  async startRound(data: { mode?: 'normal' | 'daily' | 'challenge'; seed?: string }) {
    return fetchApi<{
      success: boolean;
      roundId: string;
      seed: string;
      serverStartedAt: number;
      mode: string;
    }>('/api/round/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async submitRound(data: {
    roundId: string;
    clickLogs: ClickLog[];
    chatId?: string;
  }) {
    return fetchApi<{
      success: boolean;
      confirmedScore: number;
      earnedXp: number;
      earnedStardust: number;
      level: number;
      isLevelUp: boolean;
      rankTitle: string;
      flags?: string[];
      rejected?: boolean;
      reason?: string;
    }>('/api/round/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getLeaderboard(scope: 'global' | 'daily' | 'friends' | 'chat' = 'global', chatId?: string) {
    const params = new URLSearchParams({ scope });
    if (chatId) params.append('chatId', chatId);
    return fetchApi<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`);
  },

  async updateUserSettings(settings: { hideFromLeaderboard?: boolean; notificationsEnabled?: boolean }) {
    return fetchApi<{ success: boolean; hideFromLeaderboard: boolean; notificationsEnabled: boolean }>('/api/user/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  async createInvoice(itemId: string) {
    return fetchApi<{ success: boolean; invoiceUrl: string; paymentId: string; error?: string }>('/api/stars/create-invoice', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  },

  async getPaymentStatus(paymentId: string) {
    return fetchApi<{ success: boolean; paymentId: string; itemId?: string; starsAmount?: number; status: string; isPaid: boolean }>(`/api/stars/status/${encodeURIComponent(paymentId)}`);
  },

  async claimDaily() {
    return fetchApi<{
      success: boolean;
      streak: number;
      rewardStardust: number;
      hasStreakInsurance: boolean;
    }>('/api/daily/claim', {
      method: 'POST',
    });
  },

  async claimAchievement(achievementId: string) {
    return fetchApi<{
      success: boolean;
      achievementId: string;
      rewardStardust: number;
      rewardXp: number;
    }>('/api/achievements/claim', {
      method: 'POST',
      body: JSON.stringify({ achievementId }),
    });
  },

  async buyItem(itemId: string) {
    return fetchApi<{
      success: boolean;
      itemId: string;
      remainingStardust: number;
    }>('/api/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  },

  async equipItem(category: string, itemId: string) {
    return fetchApi<{
      success: boolean;
      category: string;
      itemId: string;
    }>('/api/equip', {
      method: 'POST',
      body: JSON.stringify({ category, itemId }),
    });
  },

  async claimReferralTier(tierLevel: number) {
    return fetchApi<{
      success: boolean;
      tierLevel: number;
      rewardStardust: number;
      rewardShipId?: string;
    }>('/api/referrals/claim', {
      method: 'POST',
      body: JSON.stringify({ tierLevel }),
    });
  },

  async getChallengeInfo(id: string) {
    return fetchApi<{
      success: boolean;
      challenge: {
        id: string;
        challengerName: string;
        challengerScore: number;
        targetSeed: string;
        expiresInSeconds: number;
      };
    }>(`/api/challenge/info?id=${encodeURIComponent(id)}`);
  },

  // --- Admin API Methods ---
  async getAdminMetrics() {
    return fetchApi<{ metrics: AdminMetrics }>('/api/admin/metrics');
  },

  async getAdminPlayers(search: string = '') {
    const params = new URLSearchParams({ search });
    return fetchApi<{ players: PlayerAdminView[] }>(`/api/admin/players?${params.toString()}`);
  },

  async performAdminPlayerAction(userId: string, action: 'ban' | 'unban' | 'shadow_ban' | 'unshadow_ban' | 'reset_score') {
    return fetchApi<{ success: boolean }>('/api/admin/players/action', {
      method: 'POST',
      body: JSON.stringify({ userId, action }),
    });
  },

  async getAdminPayments() {
    return fetchApi<{ payments: PaymentRecord[] }>('/api/admin/payments');
  },

  async refundAdminPayment(chargeId: string) {
    return fetchApi<{ success: boolean }>('/api/admin/payments/refund', {
      method: 'POST',
      body: JSON.stringify({ chargeId }),
    });
  },

  async getAdminConfig() {
    return fetchApi<{ config: LiveEventConfig }>('/api/admin/config');
  },

  async updateAdminConfig(config: LiveEventConfig) {
    return fetchApi<{ success: boolean; config: LiveEventConfig }>('/api/admin/config', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
  },

  async sendAdminBroadcast(message: string) {
    return fetchApi<{ success: boolean; totalSent: number; totalFailed: number }>('/api/admin/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async getActiveSeason() {
    return fetchApi<any>('/api/seasons/active');
  },

  async claimSeasonReward(tierIndex: number, isPaid: boolean) {
    return fetchApi<any>('/api/seasons/claim', {
      method: 'POST',
      body: JSON.stringify({ tierIndex, isPaid }),
    });
  },

  async upgradeSeasonPass() {
    return fetchApi<any>('/api/seasons/upgrade', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async getDailyQuests() {
    return fetchApi<any>('/api/daily/quests');
  },

  async claimDailyQuest(questId: string) {
    return fetchApi<any>('/api/daily/quests/claim', {
      method: 'POST',
      body: JSON.stringify({ questId }),
    });
  },

  async getDailyStatus() {
    return fetchApi<any>('/api/daily/status');
  },

  async protectStreak() {
    return fetchApi<any>('/api/daily/streak/protect', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async createChallenge(score: number, combo: number, seed: number) {
    return fetchApi<any>('/api/viral/challenge', {
      method: 'POST',
      body: JSON.stringify({ score, combo, seed }),
    });
  },

  async getChallenge(id: string) {
    return fetchApi<any>(`/api/viral/challenge/${id}`);
  },

  async getChatLeaderboard(chatId: number) {
    return fetchApi<any>(`/api/viral/chat/${chatId}`);
  },

  async updateChatScore(chatId: number, score: number) {
    return fetchApi<any>('/api/viral/chat', {
      method: 'POST',
      body: JSON.stringify({ chatId, score }),
    });
  },

  async getReferrals() {
    return fetchApi<any>('/api/viral/referrals');
  },

  async getTeamGoal() {
    return fetchApi<any>('/api/viral/team-goal');
  },

  async getNotificationPrefs() {
    return fetchApi<any>('/api/notifications/prefs');
  },

  async updateNotificationPrefs(prefs: { enabled?: boolean; quietStart?: number; quietEnd?: number; timezone?: string }) {
    return fetchApi<any>('/api/notifications/prefs', {
      method: 'POST',
      body: JSON.stringify(prefs),
    });
  },
};

