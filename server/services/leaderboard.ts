import { query, isDbActive } from '../db.js';
import { config } from '../config.js';
import {
  redisZAdd,
  redisZScore,
  redisZRevRange,
  redisZRevRank,
  redisZRem,
} from '../redis.js';

export interface LeaderboardUserEntry {
  rank: number;
  userId: string;
  username?: string;
  firstName: string;
  score: number;
  rankTitle: string;
  isCurrentUser: boolean;
  avatarUrl?: string;
}

export interface LeaderboardResponse {
  success: boolean;
  scope: 'global' | 'daily' | 'friends' | 'chat';
  seasonTitle: string;
  entries: LeaderboardUserEntry[];
  currentUser?: {
    rank: number | null;
    score: number;
    rankTitle: string;
    hideFromLeaderboard: boolean;
  };
}

export function getRankTitle(score: number): string {
  if (score >= 15000) return 'Fleet Admiral';
  if (score >= 8000) return 'Commander';
  return 'Pilot';
}

/**
 * Record user's presence/participation in a Telegram chat
 */
export async function recordUserChat(userId: bigint | number | string, chatId: bigint | number | string): Promise<void> {
  if (!isDbActive() || !chatId) return;
  try {
    await query(
      `INSERT INTO user_chats (user_id, chat_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, chat_id) DO UPDATE SET updated_at = NOW()`,
      [userId, chatId]
    );
  } catch (err) {
    console.error('Error recording user chat:', err);
  }
}

/**
 * Update Redis & DB leaderboards when a round is submitted
 */
export async function updateLeaderboardOnRoundSubmit(
  userId: bigint | number | string,
  score: number,
  mode: string,
  chatId?: bigint | number | string
): Promise<void> {
  if (!isDbActive()) return;

  try {
    // 1. Check if user is hidden or banned
    const uRes = await query(
      `SELECT is_banned, shadow_banned, hide_from_leaderboard FROM users WHERE id = $1`,
      [userId]
    );
    if (uRes.rows.length === 0) return;
    const userRow = uRes.rows[0];
    if (userRow.is_banned || userRow.shadow_banned || userRow.hide_from_leaderboard) {
      // Remove from Redis if present
      await redisZRem('leaderboard:global', String(userId));
      const todayStr = new Date().toISOString().split('T')[0];
      await redisZRem(`leaderboard:daily:${todayStr}`, String(userId));
      return;
    }

    const userIdStr = String(userId);

    // 2. Global Leaderboard Redis ZADD (keep highest score)
    const currentGlobalScore = await redisZScore('leaderboard:global', userIdStr);
    if (currentGlobalScore === null || score > currentGlobalScore) {
      await redisZAdd('leaderboard:global', score, userIdStr);
    }

    // 3. Daily Leaderboard Redis ZADD
    if (mode === 'daily') {
      const todayStr = new Date().toISOString().split('T')[0];
      const dailyKey = `leaderboard:daily:${todayStr}`;
      const currentDailyScore = await redisZScore(dailyKey, userIdStr);
      if (currentDailyScore === null || score > currentDailyScore) {
        await redisZAdd(dailyKey, score, userIdStr);
      }
    }

    // 4. Chat Leaderboard
    if (chatId) {
      await recordUserChat(userId, chatId);
      const chatKey = `leaderboard:chat:${chatId}`;
      const currentChatScore = await redisZScore(chatKey, userIdStr);
      if (currentChatScore === null || score > currentChatScore) {
        await redisZAdd(chatKey, score, userIdStr);
      }
    }

    // Also update Redis for user's existing chats
    const chatsRes = await query(`SELECT chat_id FROM user_chats WHERE user_id = $1`, [userId]);
    for (const row of chatsRes.rows) {
      const cKey = `leaderboard:chat:${row.chat_id}`;
      const cScore = await redisZScore(cKey, userIdStr);
      if (cScore === null || score > cScore) {
        await redisZAdd(cKey, score, userIdStr);
      }
    }
  } catch (err) {
    console.error('Error updating leaderboard on round submit:', err);
  }
}

/**
 * Remove user completely from all Redis leaderboards (global, past 7 days daily, and all chat leaderboards)
 */
export async function removeUserFromAllLeaderboards(userId: bigint | number | string): Promise<void> {
  const userIdStr = String(userId);
  try {
    await redisZRem('leaderboard:global', userIdStr);
    
    // Clear user from today and past 7 days of daily leaderboards
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      await redisZRem(`leaderboard:daily:${dateStr}`, userIdStr);
    }

    if (isDbActive()) {
      const chatsRes = await query(`SELECT chat_id FROM user_chats WHERE user_id = $1`, [userId]);
      for (const row of chatsRes.rows) {
        await redisZRem(`leaderboard:chat:${row.chat_id}`, userIdStr);
      }
    }
  } catch (err) {
    console.error('Error removing user from leaderboards:', err);
    if (config.nodeEnv === 'production') {
      throw err;
    }
  }
}

/**
 * Permanently delete user account (GDPR & Privacy compliance)
 * - Removes user from all Redis leaderboards
 * - Preserves payment records for accounting reconciliation by setting user_id = NULL
 * - Deletes user record from database (cascades to wallets, rounds, inventory, etc.)
 * - Never reports success on error
 */
export async function deleteUserAccount(userId: bigint | number | string): Promise<{ success: boolean; error?: string }> {
  if (!isDbActive()) {
    return { success: false, error: 'Database inactive' };
  }
  try {
    // 1. Remove from all Redis leaderboards (global, daily, chats)
    await removeUserFromAllLeaderboards(userId);

    // 2. Preserve financial payment records for accounting reconciliation
    await query(`UPDATE payments SET user_id = NULL WHERE user_id = $1`, [userId]);

    // 3. Delete user record using canonical users.id
    const res = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [userId]);
    if (res.rowCount === 0) {
      return { success: false, error: 'User not found or already deleted' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error deleting user account:', err);
    return { success: false, error: 'Internal database error during account deletion' };
  }
}

/**
 * Fetch leaderboard for specified scope
 */
export async function getLeaderboard(
  scope: 'global' | 'daily' | 'friends' | 'chat',
  currentUserId: bigint | number | string,
  options: { chatId?: bigint | number | string; lang?: string } = {}
): Promise<LeaderboardResponse> {
  let seasonTitle = 'Season 1: Neon Storm';
  const currentUserIdStr = String(currentUserId);

  if (isDbActive()) {
    try {
      const seasonRes = await query(
        `SELECT title_en, title_ru FROM seasons WHERE is_active = true ORDER BY starts_at DESC LIMIT 1`
      );
      if (seasonRes.rows.length > 0) {
        seasonTitle =
          options.lang === 'ru'
            ? seasonRes.rows[0].title_ru
            : seasonRes.rows[0].title_en;
      }
    } catch (err) {
      console.error('Error fetching active season:', err);
    }
  }

  // Check current user privacy setting & user state
  let hideFromLeaderboard = false;
  if (isDbActive()) {
    try {
      const uRes = await query(
        `SELECT hide_from_leaderboard FROM users WHERE id = $1`,
        [currentUserId]
      );
      if (uRes.rows.length > 0) {
        hideFromLeaderboard = !!uRes.rows[0].hide_from_leaderboard;
      }
    } catch (err) {
      console.error('Error fetching user privacy state:', err);
    }
  }

  let dbRows: any[] = [];

  if (isDbActive()) {
    try {
      if (scope === 'daily') {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND r.mode = 'daily'
             AND r.started_at >= CURRENT_DATE
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          []
        );
        dbRows = res.rows;
      } else if (scope === 'friends') {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
             AND (
               u.id = $1
               OR u.id IN (SELECT invitee_id FROM referrals WHERE inviter_id = $1)
               OR u.id IN (SELECT inviter_id FROM referrals WHERE invitee_id = $1)
             )
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          [currentUserId]
        );
        dbRows = res.rows;
      } else if (scope === 'chat' && options.chatId) {
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           JOIN user_chats uc ON u.id = uc.user_id
           WHERE r.status = 'submitted'
             AND uc.chat_id = $1
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          [options.chatId]
        );
        dbRows = res.rows;
      } else {
        // Global scope
        const res = await query(
          `SELECT u.id, u.username, u.first_name, u.avatar_url, MAX(r.score) as score
           FROM users u
           JOIN rounds r ON u.id = r.user_id
           WHERE r.status = 'submitted'
             AND u.is_banned = FALSE
             AND u.shadow_banned = FALSE
             AND u.hide_from_leaderboard = FALSE
           GROUP BY u.id, u.username, u.first_name, u.avatar_url
           ORDER BY score DESC
           LIMIT 50`,
          []
        );
        dbRows = res.rows;
      }
    } catch (err) {
      console.error('Database leaderboard query error:', err);
    }
  }

  // Format entries
  const entries: LeaderboardUserEntry[] = dbRows.map((row: any, idx: number) => {
    const scoreVal = Number(row.score || 0);
    const userIdStr = String(row.id);
    return {
      rank: idx + 1,
      userId: userIdStr,
      username: row.username || undefined,
      firstName: row.first_name || row.username || 'Pilot',
      score: scoreVal,
      rankTitle: getRankTitle(scoreVal),
      isCurrentUser: userIdStr === currentUserIdStr,
      avatarUrl: row.avatar_url || undefined,
    };
  });

  // Calculate current user's specific rank & highest score in this scope
  let userRank: number | null = null;
  let userScore = 0;

  if (isDbActive()) {
    try {
      let scoreRes: any;
      if (scope === 'daily') {
        scoreRes = await query(
          `SELECT MAX(score) as max_score FROM rounds WHERE user_id = $1 AND mode = 'daily' AND status = 'submitted' AND started_at >= CURRENT_DATE`,
          [currentUserId]
        );
      } else if (scope === 'chat' && options.chatId) {
        scoreRes = await query(
          `SELECT MAX(r.score) as max_score FROM rounds r JOIN user_chats uc ON r.user_id = uc.user_id WHERE r.user_id = $1 AND uc.chat_id = $2 AND r.status = 'submitted'`,
          [currentUserId, options.chatId]
        );
      } else {
        scoreRes = await query(
          `SELECT MAX(score) as max_score FROM rounds WHERE user_id = $1 AND status = 'submitted'`,
          [currentUserId]
        );
      }

      if (scoreRes.rows.length > 0 && scoreRes.rows[0].max_score !== null) {
        userScore = Number(scoreRes.rows[0].max_score);
      }

      // Check if current user is in top entries list
      const inTopEntry = entries.find((e) => e.isCurrentUser);
      if (inTopEntry) {
        userRank = inTopEntry.rank;
      } else if (userScore > 0 && !hideFromLeaderboard) {
        // Calculate rank outside top 50
        let rankRes: any;
        if (scope === 'daily') {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND r.mode = 'daily' AND r.started_at >= CURRENT_DATE
                 AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $1`,
            [userScore]
          );
        } else if (scope === 'friends') {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
                 AND (u.id = $1 OR u.id IN (SELECT invitee_id FROM referrals WHERE inviter_id = $1) OR u.id IN (SELECT inviter_id FROM referrals WHERE invitee_id = $1))
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $2`,
            [currentUserId, userScore]
          );
        } else if (scope === 'chat' && options.chatId) {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id JOIN user_chats uc ON u.id = uc.user_id
               WHERE r.status = 'submitted' AND uc.chat_id = $1 AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $2`,
            [options.chatId, userScore]
          );
        } else {
          rankRes = await query(
            `WITH user_scores AS (
               SELECT u.id, MAX(r.score) as score
               FROM users u JOIN rounds r ON u.id = r.user_id
               WHERE r.status = 'submitted' AND u.is_banned = FALSE AND u.shadow_banned = FALSE AND u.hide_from_leaderboard = FALSE
               GROUP BY u.id
             )
             SELECT COUNT(*) + 1 as rank FROM user_scores WHERE score > $1`,
            [userScore]
          );
        }

        if (rankRes.rows.length > 0) {
          userRank = Number(rankRes.rows[0].rank);
        }
      }
    } catch (err) {
      console.error('Error calculating user rank:', err);
    }
  }

  return {
    success: true,
    scope,
    seasonTitle,
    entries,
    currentUser: {
      rank: userRank,
      score: userScore,
      rankTitle: getRankTitle(userScore),
      hideFromLeaderboard,
    },
  };
}
