import { query, transaction, isDbActive } from '../db.js';
import { config } from '../config.js';
import crypto from 'crypto';

export async function createChallenge(creatorId: number, score: number, combo: number, seed: number) {
  const challengeId = crypto.randomBytes(6).toString('hex');
  if (await isDbActive()) {
    await query(
      `INSERT INTO challenges (id, creator_id, score, combo, seed) VALUES ($1, $2, $3, $4, $5)`,
      [challengeId, creatorId, score, combo, seed]
    );
  }
  return challengeId;
}

export async function getChallenge(challengeId: string) {
  if (!await isDbActive()) return null;
  const res = await query(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);
  return res.rows[0] || null;
}

export async function updateChatScore(chatId: number, userId: number, username: string, firstName: string, score: number) {
  if (!await isDbActive()) return;
  await query(
    `INSERT INTO chat_leaderboards (chat_id, user_id, username, first_name, total_score, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (chat_id, user_id) 
     DO UPDATE SET total_score = chat_leaderboards.total_score + $5, username = $3, first_name = $4, updated_at = CURRENT_TIMESTAMP`,
    [chatId, userId, username, firstName, score]
  );
}

export async function getChatLeaderboard(chatId: number) {
  if (!await isDbActive()) return [];
  const res = await query(
    `SELECT user_id, username, first_name, total_score FROM chat_leaderboards WHERE chat_id = $1 ORDER BY total_score DESC LIMIT 10`,
    [chatId]
  );
  return res.rows;
}

export async function registerReferral(referrerId: number, referredId: number) {
  if (!await isDbActive() || referrerId === referredId) return;
  try {
    await query(
      `INSERT INTO referrals_v2 (referrer_id, referred_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
      [referrerId, referredId]
    );
  } catch (e) {
    console.error('Error registering referral:', e);
  }
}

export async function activateReferral(referredId: number) {
  if (!await isDbActive()) return;
  await transaction(async (client) => {
    // Atomically update referral status to 'active' using conditional UPDATE to prevent double rewarding
    const updateRes = await client.query(
      `UPDATE referrals_v2 
       SET status = 'active' 
       WHERE referred_id = $1 AND status = 'pending' 
       RETURNING referrer_id`,
      [referredId]
    );

    if (updateRes.rows.length === 0) return;
    const referrerId = updateRes.rows[0].referrer_id;

    // Ensure wallets exist
    await client.query(
      `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
      [referredId]
    );
    await client.query(
      `INSERT INTO wallets (user_id, stardust, xp, level) VALUES ($1, 0, 0, 1) ON CONFLICT (user_id) DO NOTHING`,
      [referrerId]
    );

    // Give start bonus to referred user using wallets table (NE-10)
    await client.query(
      `UPDATE wallets SET stardust = stardust + 50, xp = xp + 100 WHERE user_id = $1`,
      [referredId]
    );

    // Give referral bonus to referrer using wallets table
    await client.query(
      `UPDATE wallets SET stardust = stardust + 250 WHERE user_id = $1`,
      [referrerId]
    );
  });
}

export async function getUserReferrals(userId: number) {
  if (!await isDbActive()) return { count: 0, referrals: [] };
  const countRes = await query(`SELECT COUNT(*) as cnt FROM referrals_v2 WHERE referrer_id = $1 AND status = 'active'`, [userId]);
  // Fixed: removed non-existent created_id column, use created_at instead (NE-10)
  const listRes = await query(`SELECT r.referred_id, r.status, r.created_at, u.username, u.first_name FROM referrals_v2 r LEFT JOIN users u ON r.referred_id = u.id WHERE r.referrer_id = $1`, [userId]);
  return {
    count: parseInt(countRes.rows[0]?.cnt || '0'),
    referrals: listRes.rows
  };
}

export async function getTeamGoal() {
  if (!await isDbActive()) {
    if (config.mockModeAllowed) {
      return { id: 'goal_current_week', title_en: 'Fleet Weekly Goal: 10M Score', title_ru: 'Еженедельная цель флота: 10М очков', target_score: 10000000, current_score: 0, completed: false };
    }
    throw new Error('DATABASE_UNAVAILABLE');
  }
  const res = await query(`SELECT * FROM team_goals ORDER BY week_start DESC LIMIT 1`);
  return res.rows[0] || null;
}

export async function contributeTeamGoal(score: number) {
  if (!await isDbActive()) return;
  if (score <= 0 || score > 1000000) return;
  await query(`UPDATE team_goals SET current_score = current_score + $1 WHERE week_end > CURRENT_TIMESTAMP AND completed = false`, [score]);
  const goal = await getTeamGoal();
  if (goal && goal.current_score >= goal.target_score && !goal.completed) {
    await query(`UPDATE team_goals SET completed = true WHERE id = $1`, [goal.id]);
  }
}
