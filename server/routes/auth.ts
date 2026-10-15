import { getMockDailyClaim } from "./economy.js";
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { query, isDbActive } from "../db.js";
import { config } from "../config.js";
import { redisZRem } from "../redis.js";
import { deleteUserAccount } from "../services/leaderboard.js";
import {
  updateUserSettingsSchema,
  checkNicknameSchema,
  registerUserSchema,
  updateAvatarSchema,
} from "../validators.js";

const router = Router();

// In-memory mock store for test/offline environments
const mockRegisteredUsers = new Map<number, { username: string; avatarUrl?: string; isRegistered: boolean }>();

router.get("/session", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  let wallet = { stardust: 150, xp: 0, level: 1 };
  let equipped = {
    ship: "ship_cyber_wing",
    trail: "trail_cyan_beam",
    backdrop: "backdrop_synth_grid",
    explosion: "exp_retro_burst",
    frame: "frame_pilot_steel",
    theme: "theme_classic_purple",
  };
  let inventory: string[] = ["ship_cyber_wing", "backdrop_synth_grid"];
  let achievements: string[] = [];
  const todayStr = new Date().toISOString().split("T")[0];
  let dailyClaimStreak = { streak: 0, lastClaimDate: "", claimedToday: false, canClaim: true };
  let referralsCount = 0;
  let hasStreakInsurance = false;
  let hideFromLeaderboard = false;
  let notificationsEnabled = true;
  let avatarUrl: string | undefined = undefined;
  let isRegistered = false;
  let currentUsername = user.username;

  if (isDbActive()) {
    try {
      // 1. Fetch wallet
      const wRes = await query("SELECT stardust, xp, level FROM wallets WHERE user_id = $1", [user.id]);
      if (wRes.rows.length > 0) {
        wallet = {
          stardust: Number(wRes.rows[0].stardust),
          xp: Number(wRes.rows[0].xp),
          level: Number(wRes.rows[0].level),
        };
      }
      // 2. Fetch equipped
      const eqRes = await query(
        "SELECT ship, trail, backdrop, explosion, frame, theme FROM equipped WHERE user_id = $1",
        [user.id]
      );
      if (eqRes.rows.length > 0) {
        const row = eqRes.rows[0];
        equipped = {
          ship: row.ship || "ship_cyber_wing",
          trail: row.trail || "trail_cyan_beam",
          backdrop: row.backdrop || "backdrop_synth_grid",
          explosion: row.explosion || "exp_retro_burst",
          frame: row.frame || "frame_pilot_steel",
          theme: row.theme || "theme_classic_purple",
        };
      }
      // 3. Fetch inventory
      const invRes = await query("SELECT item_id FROM inventory WHERE user_id = $1", [user.id]);
      if (invRes.rows.length > 0) {
        inventory = invRes.rows.map((r: any) => String(r.item_id));
      }
      // 4. Fetch achievements
      const achRes = await query("SELECT achievement_id FROM achievements WHERE user_id = $1", [user.id]);
      if (achRes.rows.length > 0) {
        achievements = achRes.rows.map((r: any) => String(r.achievement_id));
      }
      // 5. Fetch daily claims
      const claimRes = await query(
        "SELECT streak, claim_date FROM daily_claims WHERE user_id = $1 ORDER BY claim_date DESC LIMIT 1",
        [user.id]
      );
      if (claimRes.rows.length > 0) {
        const rawDate = claimRes.rows[0].claim_date;
        const lastDate =
          typeof rawDate === "string"
            ? rawDate.split("T")[0]
            : rawDate instanceof Date
            ? rawDate.toISOString().split("T")[0]
            : String(rawDate).split("T")[0];
        const isClaimedToday = lastDate === todayStr;
        dailyClaimStreak = {
          streak: Number(claimRes.rows[0].streak || 1),
          lastClaimDate: lastDate,
          claimedToday: isClaimedToday,
          canClaim: !isClaimedToday,
        };
      }
      // 6. Fetch referral count
      const refRes = await query("SELECT COUNT(*) as count FROM referrals WHERE inviter_id = $1", [user.id]);
      if (refRes.rows.length > 0) {
        referralsCount = Number(refRes.rows[0].count || 0);
      }
      // 7. Fetch user streak insurance, privacy state, avatar and registration state
      const uRes = await query(
        "SELECT has_streak_insurance, hide_from_leaderboard, notifications_enabled, avatar_url, is_registered, username FROM users WHERE id = $1",
        [user.id]
      );
      if (uRes.rows.length > 0) {
        hasStreakInsurance = !!uRes.rows[0].has_streak_insurance;
        hideFromLeaderboard = !!uRes.rows[0].hide_from_leaderboard;
        notificationsEnabled = uRes.rows[0].notifications_enabled !== false;
        if (uRes.rows[0].avatar_url) avatarUrl = uRes.rows[0].avatar_url;
        if (uRes.rows[0].is_registered !== undefined) isRegistered = !!uRes.rows[0].is_registered;
        if (uRes.rows[0].username) currentUsername = uRes.rows[0].username;
      }
    } catch (err) {
      console.error("Error fetching session data from DB:", err);
    }
  }

  if (!isDbActive()) {
    const mock = getMockDailyClaim(user.id);
    if (mock) {
      const isClaimedToday = mock.lastClaimDate === todayStr;
      dailyClaimStreak = {
        streak: mock.streak,
        lastClaimDate: mock.lastClaimDate,
        claimedToday: isClaimedToday,
        canClaim: !isClaimedToday,
      };
    }
    const mockUser = mockRegisteredUsers.get(user.id);
    if (mockUser) {
      if (mockUser.avatarUrl) avatarUrl = mockUser.avatarUrl;
      isRegistered = mockUser.isRegistered;
      currentUsername = mockUser.username;
    }
  }

  res.json({
    profile: {
      id: user.id,
      username: currentUsername,
      firstName: user.firstName,
      language: user.language,
      isPremium: user.isPremium,
      isAdmin: user.isAdmin,
      isDemo: !!user.isDemo,
      referralCode: `ref_${user.id}`,
      referralsCount,
      hasStreakInsurance,
      hideFromLeaderboard,
      notificationsEnabled,
      avatarUrl,
      isRegistered,
    },
    wallet,
    equipped,
    inventory,
    achievements,
    dailyClaimStreak,
    authDiagnostics: {
      isTelegramValid: !user.isDemo,
      hasBotToken: Boolean(config.botToken),
      isDemo: Boolean(user.isDemo),
    },
  });
});

/**
 * POST /api/user/nickname/check
 * Check if username is available and valid
 */
router.post("/user/nickname/check", requireAuth, async (req: Request, res: Response) => {
  const parsed = checkNicknameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ available: false, error: parsed.error.issues[0]?.message || "Неверный никнейм" });
  }
  const user = req.user!;
  const target = parsed.data.nickname.trim().toLowerCase();

  if (isDbActive()) {
    try {
      const existing = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 AND is_registered = TRUE LIMIT 1",
        [target, user.id]
      );
      if (existing.rows.length > 0) {
        return res.json({ available: false, reason: "Этот никнейм уже занят. Выберите другой." });
      }
    } catch (err) {
      console.error("Error checking nickname in DB:", err);
    }
  } else {
    for (const [uid, record] of mockRegisteredUsers.entries()) {
      if (uid !== user.id && record.isRegistered && record.username.toLowerCase() === target) {
        return res.json({ available: false, reason: "Этот никнейм уже занят. Выберите другой." });
      }
    }
  }

  return res.json({ available: true });
});

/**
 * POST /api/user/register
 * Register user nickname & avatar, setting is_registered = true
 */
router.post("/user/register", requireAuth, async (req: Request, res: Response) => {
  const parsed = registerUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Неверный формат никнейма" });
  }
  const user = req.user!;
  const { nickname, avatarUrl } = parsed.data;
  const targetLower = nickname.trim().toLowerCase();

  if (isDbActive()) {
    try {
      const existing = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 AND is_registered = TRUE LIMIT 1",
        [targetLower, user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Этот никнейм уже занят. Пожалуйста, выберите другой." });
      }

      await query(
        `UPDATE users SET username = $1, avatar_url = COALESCE($2, avatar_url), is_registered = TRUE WHERE id = $3`,
        [nickname.trim(), avatarUrl || null, user.id]
      );
    } catch (err: any) {
      if (err?.code === "23505") {
        return res.status(400).json({ error: "Этот никнейм уже занят. Пожалуйста, выберите другой." });
      }
      console.error("Error registering user in DB:", err);
      return res.status(500).json({ error: "Не удалось зарегистрировать никнейм" });
    }
  } else {
    for (const [uid, record] of mockRegisteredUsers.entries()) {
      if (uid !== user.id && record.isRegistered && record.username.toLowerCase() === targetLower) {
        return res.status(400).json({ error: "Этот никнейм уже занят. Пожалуйста, выберите другой." });
      }
    }
    mockRegisteredUsers.set(user.id, {
      username: nickname.trim(),
      avatarUrl,
      isRegistered: true,
    });
  }

  user.username = nickname.trim();
  return res.json({
    success: true,
    username: nickname.trim(),
    avatarUrl,
    isRegistered: true,
  });
});

/**
 * POST /api/user/avatar
 * Update custom avatar
 */
router.post("/user/avatar", requireAuth, async (req: Request, res: Response) => {
  const parsed = updateAvatarSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid avatar data" });
  }
  const user = req.user!;
  const { avatarUrl } = parsed.data;

  if (isDbActive()) {
    try {
      await query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, user.id]);
    } catch (err) {
      console.error("Error updating avatar in DB:", err);
      return res.status(500).json({ error: "Failed to update avatar" });
    }
  } else {
    const rec = mockRegisteredUsers.get(user.id) || { username: user.username, isRegistered: false };
    rec.avatarUrl = avatarUrl;
    mockRegisteredUsers.set(user.id, rec);
  }

  return res.json({ success: true, avatarUrl });
});

/**
 * POST /api/user/settings
 * Update user settings
 */
router.post("/user/settings", requireAuth, async (req: Request, res: Response) => {
  const parsed = updateUserSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
  }
  const user = req.user!;
  const { hideFromLeaderboard, notificationsEnabled } = parsed.data;

  if (isDbActive()) {
    try {
      if (typeof hideFromLeaderboard === "boolean") {
        await query("UPDATE users SET hide_from_leaderboard = $1 WHERE id = $2", [hideFromLeaderboard, user.id]);
        if (hideFromLeaderboard) {
          const todayStr = new Date().toISOString().split("T")[0];
          await redisZRem("leaderboard:global", String(user.id));
          await redisZRem(`leaderboard:daily:${todayStr}`, String(user.id));
        }
      }
      if (typeof notificationsEnabled === "boolean") {
        await query("UPDATE users SET notifications_enabled = $1 WHERE id = $2", [notificationsEnabled, user.id]);
      }
    } catch (err) {
      console.error("Error updating user settings in DB:", err);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }

  res.json({
    success: true,
    hideFromLeaderboard: Boolean(hideFromLeaderboard),
    notificationsEnabled: typeof notificationsEnabled === "boolean" ? notificationsEnabled : true,
  });
});

/**
 * POST /api/user/delete-account
 */
router.post("/user/delete-account", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  if (isDbActive()) {
    const result = await deleteUserAccount(user.id);
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to delete account" });
    }
  }
  res.json({ success: true, message: "Account permanently erased" });
});

export default router;
