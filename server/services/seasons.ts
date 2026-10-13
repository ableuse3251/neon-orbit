import { query, transaction, isDbActive } from '../db.js';

export interface SeasonInfo {
  id: string;
  titleEn: string;
  titleRu: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  archived: boolean;
  rewards: any;
}

export interface SeasonPassTier {
  tier: number;
  pointsRequired: number;
  freeReward: { type: string; id: string; amount: number; nameEn: string; nameRu: string };
  paidReward: { type: string; id: string; amount: number; nameEn: string; nameRu: string };
}

export const DEFAULT_SEASON_TIERS: SeasonPassTier[] = [
  {
    tier: 1,
    pointsRequired: 100,
    freeReward: { type: 'stardust', id: 'stardust', amount: 100, nameEn: '100 Stardust', nameRu: '100 Звездной пыли' },
    paidReward: { type: 'cosmetic', id: 'trail_cyan', amount: 1, nameEn: 'Neon Cyan Trail', nameRu: 'Неоновый циан след' }
  },
  {
    tier: 2,
    pointsRequired: 300,
    freeReward: { type: 'stardust', id: 'stardust', amount: 250, nameEn: '250 Stardust', nameRu: '250 Звездной пыли' },
    paidReward: { type: 'cosmetic', id: 'ship_interceptor', amount: 1, nameEn: 'Interceptor Ship', nameRu: 'Корабль Перехватчик' }
  },
  {
    tier: 3,
    pointsRequired: 600,
    freeReward: { type: 'stardust', id: 'stardust', amount: 500, nameEn: '500 Stardust', nameRu: '500 Звездной пыли' },
    paidReward: { type: 'cosmetic', id: 'frame_gold', amount: 1, nameEn: 'Golden Frame', nameRu: 'Золотая рамка' }
  },
  {
    tier: 4,
    pointsRequired: 1000,
    freeReward: { type: 'stardust', id: 'stardust', amount: 1000, nameEn: '1000 Stardust', nameRu: '1000 Звездной пыли' },
    paidReward: { type: 'cosmetic', id: 'trail_gold', amount: 1, nameEn: 'Golden Trail', nameRu: 'Золотой след' }
  },
  {
    tier: 5,
    pointsRequired: 1500,
    freeReward: { type: 'stardust', id: 'stardust', amount: 2000, nameEn: '2000 Stardust', nameRu: '2000 Звездной пыли' },
    paidReward: { type: 'cosmetic', id: 'ship_cruiser', amount: 1, nameEn: 'Cruiser Ship', nameRu: 'Корабль Крейсер' }
  }
];

/**
 * Check and perform automatic season rollover if active season has expired
 */
export async function checkAndRolloverSeasons(): Promise<SeasonInfo | null> {
  if (!isDbActive()) return null;

  try {
    const res = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived, rewards
       FROM seasons WHERE is_active = TRUE LIMIT 1`
    );

    if (res.rows.length === 0) {
      // Create initial active season if none exist
      const newId = 'season_1';
      const now = new Date();
      const endsAt = new Date(now.getTime() + 14 * 86400000);
      await query(
        `INSERT INTO seasons (id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
         ON CONFLICT (id) DO UPDATE SET is_active = TRUE`,
        [newId, 'Season 1: Neon Storm', 'Сезон 1: Неоновый Шторм', 'synthwave', now.toISOString(), endsAt.toISOString()]
      );
      return getActiveSeason();
    }

    const currentSeason = res.rows[0];
    const endsAtDate = new Date(currentSeason.ends_at);
    const now = new Date();

    if (now >= endsAtDate) {
      console.log(`Season ${currentSeason.id} has ended. Executing season rollover...`);

      // 1. Finalize current season: archive and distribute rewards to top 100
      await transaction(async (client) => {
        // Mark current season as archived and inactive
        await client.query(
          `UPDATE seasons SET is_active = FALSE, archived = TRUE WHERE id = $1`,
          [currentSeason.id]
        );

        // Fetch top 100 players for ranking rewards
        const topRes = await client.query(
          `SELECT user_id, score, rounds_played FROM season_scores WHERE season_id = $1 ORDER BY score DESC LIMIT 100`,
          [currentSeason.id]
        );

        for (let i = 0; i < topRes.rows.length; i++) {
          const row = topRes.rows[i];
          const rank = i + 1;
          const userId = row.user_id;

          let rewardDust = 500;
          let rankTitle = 'Pilot';

          if (rank === 1) {
            rewardDust = 5000;
            rankTitle = 'Fleet Admiral';
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_gold', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else if (rank <= 3) {
            rewardDust = 3000;
            rankTitle = 'Commander';
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_silver', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else if (rank <= 10) {
            rewardDust = 1500;
            rankTitle = 'Captain';
            await client.query(
              `INSERT INTO inventory (user_id, item_id, source) VALUES ($1, 'frame_bronze', 'season_reward') ON CONFLICT DO NOTHING`,
              [userId]
            );
          } else {
            rankTitle = 'Veteran Pilot';
          }

          // Credit dust reward
          await client.query(
            `UPDATE wallets SET stardust = stardust + $1 WHERE user_id = $2`,
            [rewardDust, userId]
          );

          // Update rank title in season scores archive
          await client.query(
            `UPDATE season_scores SET rank_title = $1 WHERE season_id = $2 AND user_id = $3`,
            [rankTitle, currentSeason.id, userId]
          );
        }

        // Consolation prize for all participants with >= 3 rounds
        await client.query(
          `UPDATE wallets SET stardust = stardust + 200 
           FROM season_scores ss 
           WHERE wallets.user_id = ss.user_id AND ss.season_id = $1 AND ss.rounds_played >= 3`,
          [currentSeason.id]
        );

        // 2. Create next season automatically (e.g. season_2 or increment)
        const seasonNum = parseInt(currentSeason.id.replace('season_', ''), 10) || 1;
        const nextSeasonId = `season_${seasonNum + 1}`;
        const nextStartsAt = now;
        const nextEndsAt = new Date(now.getTime() + 14 * 86400000);
        const nextTitleEn = `Season ${seasonNum + 1}: Cyber Odyssey`;
        const nextTitleRu = `Сезон ${seasonNum + 1}: Кибер Одиссея`;

        await client.query(
          `INSERT INTO seasons (id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived)
           VALUES ($1, $2, $3, 'cyberpunk', $4, $5, TRUE, FALSE)
           ON CONFLICT (id) DO UPDATE SET is_active = TRUE, starts_at = $4, ends_at = $5`,
          [nextSeasonId, nextTitleEn, nextTitleRu, nextStartsAt.toISOString(), nextEndsAt.toISOString()]
        );
      });

      console.log('Season rollover completed successfully.');
    }

    return getActiveSeason();
  } catch (err) {
    console.error('Error during season rollover:', err);
    return null;
  }
}

export async function getActiveSeason(): Promise<SeasonInfo | null> {
  if (!isDbActive()) return null;
  try {
    const res = await query(
      `SELECT id, title_en, title_ru, theme, starts_at, ends_at, is_active, archived, rewards
       FROM seasons WHERE is_active = TRUE LIMIT 1`
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      titleEn: row.title_en,
      titleRu: row.title_ru,
      theme: row.theme || 'synthwave',
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      archived: row.archived,
      rewards: row.rewards || {}
    };
  } catch (err) {
    console.error('Error fetching active season:', err);
    return null;
  }
}

/**
 * Get user's season stats, points, pass tier, and claimed rewards
 */
export async function getUserSeasonData(userId: bigint | number | string) {
  const season = await checkAndRolloverSeasons();
  if (!season) return null;

  try {
    const scoreRes = await query(
      `SELECT score, season_points, rounds_played, rank_title, rewards_claimed, pass_tier, updated_at
       FROM season_scores WHERE season_id = $1 AND user_id = $2`,
      [season.id, userId]
    );

    let userScore = 0;
    let seasonPoints = 0;
    let roundsPlayed = 0;
    let rankTitle = 'Pilot';
    let rewardsClaimed = {};
    let passTier = 'FREE';

    if (scoreRes.rows.length > 0) {
      const row = scoreRes.rows[0];
      userScore = Number(row.score) || 0;
      seasonPoints = Number(row.season_points) || 0;
      roundsPlayed = Number(row.rounds_played) || 0;
      rankTitle = row.rank_title || 'Pilot';
      rewardsClaimed = row.rewards_claimed || {};
      passTier = row.pass_tier || 'FREE';
    } else {
      // Initialize insert
      await query(
        `INSERT INTO season_scores (season_id, user_id, score, season_points, rounds_played, rank_title, rewards_claimed, pass_tier)
         VALUES ($1, $2, 0, 0, 0, 'Pilot', '{}'::jsonb, 'FREE')
         ON CONFLICT (season_id, user_id) DO NOTHING`,
        [season.id, userId]
      );
    }

    // Determine current rank in leaderboard
    const rankRes = await query(
      `SELECT COUNT(*) + 1 as rank FROM season_scores WHERE season_id = $1 AND score > $2`,
      [season.id, userScore]
    );
    const rank = Number(rankRes.rows[0]?.rank) || 1;

    return {
      season,
      userStats: {
        score: userScore,
        seasonPoints,
        roundsPlayed,
        rankTitle,
        rank,
        passTier,
        rewardsClaimed
      },
      tiers: DEFAULT_SEASON_TIERS
    };
  } catch (err) {
    console.error('Error fetching user season data:', err);
    return null;
  }
}
