/**
 * grammY Telegram Bot Backend Handler for Neon Orbit
 * Unified bot & server integration with webhook support, grammY, Telegram Stars, and complete commands.
 */

import express from 'express';
import { Bot, InlineKeyboard, Context, InlineQueryResultBuilder } from 'grammy';
import dotenv from 'dotenv';
import { config } from './server/config.js';
import { query, isDbActive } from './server/db.js';
import { getStarsCatalogItem } from './src/shared/stars-catalog.js';
import { fulfillPayment, refundPayment, enqueuePaymentReconciliation } from './server/routes/stars.js';
import { getLeaderboard, recordUserChat, removeUserFromAllLeaderboards, deleteUserAccount } from './server/services/leaderboard.js';
import { logger } from './server/logger.js';
import crypto from 'crypto';

dotenv.config();

const token = config.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
export const bot = new Bot(token || '111111111:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

// Global error handler for grammY updates
bot.catch((err) => {
  const ctx = err.ctx;
  logger.warn(`Telegram Bot error during update ${ctx?.update?.update_id || 'unknown'}:`, err.error);
});

const APP_URL = config.appUrl || process.env.APP_URL || 'http://localhost:3000';
const BOT_USERNAME = config.botUsername || process.env.BOT_USERNAME || 'NeonOrbitBot';

function isRu(ctx: Context): boolean {
  const code = ctx.from?.language_code?.toLowerCase() || '';
  return code.startsWith('ru') || code.startsWith('be') || code.startsWith('uk');
}

// Handle /start command with challenge & referral deep link
bot.command('start', async (ctx: Context) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const ru = isRu(ctx);

  if (userId && chatId) {
    await recordUserChat(userId, chatId);
  }

  const startParam = ctx.match;
  let text = ru
    ? '🚀 **Добро пожаловать в Neon Orbit!**\n\n45-секундная космическая ретро-аркада в стиле 80s Synthwave. Тапай по астероидам, кометам и золотым маякам, разгоняй комбо-множители и ставь рекорды!'
    : '🚀 **Welcome to Neon Orbit!**\n\nThe 45-second retro synthwave space arcade clicker. Tap asteroids, comets, and golden beacons to build combo multipliers and shatter personal records!';

  if (typeof startParam === 'string' && startParam.trim()) {
    if (startParam.startsWith('challenge_')) {
      const challengeId = startParam.replace('challenge_', '');
      text = ru
        ? `🛸 **КОСМИЧЕСКАЯ ДУЭЛЬ!**\n\nПилот бросил тебе вызов на сиде \`${challengeId}\`! Жми кнопку ниже, чтобы взлететь и побить его счёт!`
        : `🛸 **COSMIC DUEL CHALLENGE!**\n\nA pilot has challenged you on seed \`${challengeId}\`! Tap below to launch your starfighter and claim orbital supremacy!`;
    } else if (startParam.startsWith('ref_')) {
      const inviterId = startParam.replace('ref_', '');
      if (inviterId && userId && String(inviterId) !== String(userId)) {
        if (isDbActive()) {
          try {
            await query(
              `INSERT INTO referrals (inviter_id, invitee_id, rewarded_at)
               VALUES ($1, $2, NOW())
               ON CONFLICT DO NOTHING`,
              [inviterId, userId]
            );
          } catch (err) {
            logger.error('Error inserting referral from /start:', err);
          }
        }
      }
      text = ru
        ? `🛸 **НАБОР В ЗВЁЗДНЫЙ ФЛОТ!**\n\nТебя пригласил пилот \`${inviterId}\`! Запусти игру и получи стартовый бонус +250 Звёздной пыли!`
        : `🛸 **STARFLEET RECRUITMENT!**\n\nYou were invited by Pilot \`${inviterId}\`! Referral logged! Launch now to claim your +250 Stardust bonus!`;
    }
  }

  const playUrl = chatId ? `${APP_URL}?chat_id=${chatId}` : APP_URL;
  const buttonText = ru ? '🎮 ИГРАТЬ В NEON ORBIT (45s)' : '🎮 PLAY NEON ORBIT (45s)';
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

// Handle /top group command with real chat leaderboard
bot.command('top', async (ctx: Context) => {
  const userId = ctx.from?.id || 0;
  const chatId = ctx.chat?.id;
  const ru = isRu(ctx);

  if (userId && chatId) {
    await recordUserChat(userId, chatId);
  }

  let text = ru ? '🏆 **ТАБЛИЦА ЛИДЕРОВ NEON ORBIT**\n\n' : '🏆 **NEON ORBIT CHAT LEADERBOARD**\n\n';

  if (chatId) {
    const leaderboardData = await getLeaderboard('chat', userId, { chatId });
    if (leaderboardData.entries.length === 0) {
      text += ru
        ? 'В этом чате пока нет рекордов!\n\nСтань первым пилотом, сыграй раунд и займи 1 место в группе!'
        : 'No recorded scores in this chat yet!\n\nBe the first pilot to launch a round and claim top rank in this group!';
    } else {
      leaderboardData.entries.slice(0, 10).forEach((entry) => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        const nameStr = entry.username ? `@${entry.username}` : entry.firstName;
        text += `${medal} ${nameStr} — **${entry.score.toLocaleString()}** pts (${entry.rankTitle})\n`;
      });
    }
  } else {
    const globalData = await getLeaderboard('global', userId);
    globalData.entries.slice(0, 10).forEach((entry) => {
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
      const nameStr = entry.username ? `@${entry.username}` : entry.firstName;
      text += `${medal} ${nameStr} — **${entry.score.toLocaleString()}** pts (${entry.rankTitle})\n`;
    });
  }

  const playUrl = chatId ? `${APP_URL}?chat_id=${chatId}` : APP_URL;
  const buttonText = ru ? '🎮 ИГРАТЬ В NEON ORBIT' : '🎮 PLAY NEON ORBIT';
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});



// Handle /feedback command
bot.command('feedback', async (ctx: Context) => {
  const ru = isRu(ctx);
  const text = ru
    ? '💬 **ОТЗЫВЫ И ПОДДЕРЖКА**\n\nСтолкнулись с багом или есть идея для нового сезона? Напишите нашему боту поддержки или оставьте отзыв в нашем Telegram-канале!'
    : '💬 **FEEDBACK & SUPPORT**\n\nFound a bug or have an idea for a new season? Drop a message to our support bot or join our community channel!';
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// Handle /delete_me command (GDPR account deletion request with confirmation)
bot.command('delete_me', async (ctx: Context) => {
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  if (!userId) {
    return ctx.reply(ru ? '❌ Не удалось определить ваш ID.' : '❌ Could not identify your user ID.');
  }

  const confirmText = ru
    ? '⚠️ **ПОДТВЕРЖДЕНИЕ УДАЛЕНИЯ АККАУНТА**\n\nВы действительно хотите полностью и безвозвратно удалить свой аккаунт, рекорды и игровую статистику в Neon Orbit? Это действие нельзя отменить.'
    : '⚠️ **ACCOUNT DELETION CONFIRMATION**\n\nDo you really want to permanently erase your account, records, and game statistics from Neon Orbit? This action cannot be undone.';

  const keyboard = new InlineKeyboard()
    .text(ru ? '🗑️ Да, удалить аккаунт' : '🗑️ Yes, delete account', `confirm_delete_${userId}`)
    .text(ru ? '❌ Отмена' : '❌ Cancel', 'cancel_delete');

  await ctx.reply(confirmText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

// Handle deletion confirmation callback query
bot.callbackQuery(/^confirm_delete_(\d+)$/, async (ctx: Context) => {
  const match = ctx.match;
  const targetUserId = match ? Number(match[1]) : 0;
  const currentUserId = ctx.from?.id;
  const ru = isRu(ctx);

  if (!currentUserId || currentUserId !== targetUserId) {
    await ctx.answerCallbackQuery({
      text: ru ? '❌ Это не ваш запрос на удаление!' : '❌ This is not your deletion request!',
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  if (isDbActive()) {
    const result = await deleteUserAccount(targetUserId);
    if (!result.success) {
      logger.error('Error deleting account via bot:', result.error);
      await ctx.editMessageText(
        ru
          ? '❌ **ОШИБКА УДАЛЕНИЯ**\n\nНе удалось удалить аккаунт из-за ошибки базы данных. Пожалуйста, попробуйте позже.'
          : '❌ **DELETION ERROR**\n\nFailed to delete account due to database error. Please try again later.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  const successText = ru
    ? '🗑️ **АККАУНТ УСПЕШНО УДАЛЕН**\n\nВсе ваши личные данные, рекорды и игровая статистика были стерты с серверов Neon Orbit согласно политике конфиденциальности.'
    : '🗑️ **ACCOUNT SUCCESSFULLY DELETED**\n\nAll your personal data, records, and game stats have been permanently wiped from Neon Orbit servers in compliance with privacy guidelines.';
  
  await ctx.editMessageText(successText, { parse_mode: 'Markdown' });
});

// Handle cancellation callback query
bot.callbackQuery('cancel_delete', async (ctx: Context) => {
  const ru = isRu(ctx);
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    ru ? '✅ **Удаление отменено.** Ваш аккаунт в безопасности.' : '✅ **Deletion cancelled.** Your account is safe.',
    { parse_mode: 'Markdown' }
  );
});

// Handle /report command (Admin metrics report)
bot.command('report', async (ctx: Context) => {
  const fromUserId = String(ctx.from?.id || '');
  const ru = isRu(ctx);

  const isAdmin = config.adminTelegramIds.some((adminId) => String(adminId) === fromUserId);
  if (!isAdmin) {
    return ctx.reply(
      ru ? '❌ **Доступ запрещен:** Требуются права администратора.' : '❌ **Unauthorized:** Admin authorization required.',
      { parse_mode: 'Markdown' }
    );
  }

  let dau = 0, wau = 0, rev = 0, rounds = 0, kFactor = 0, arpdau = 0;
  if (isDbActive()) {
    try {
      const mRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= CURRENT_DATE`);
      dau = Number(mRes.rows[0]?.cnt || 0);

      const wRes = await query(`SELECT COUNT(DISTINCT user_id) as cnt FROM users WHERE last_seen_at >= NOW() - INTERVAL '7 days'`);
      wau = Number(wRes.rows[0]?.cnt || 0);

      const rRes = await query(`SELECT COALESCE(SUM(stars_amount), 0) as total FROM payments WHERE status = 'paid'`);
      rev = Number(rRes.rows[0]?.total || 0);

      const rndRes = await query(`SELECT COUNT(*) as cnt FROM rounds WHERE status = 'submitted'`);
      rounds = Number(rndRes.rows[0]?.cnt || 0);

      const kRes = await query(`SELECT COALESCE((SELECT COUNT(*) FROM referrals_v2 WHERE status = 'active') * 1.0 / NULLIF((SELECT COUNT(*) FROM users), 0), 0) as k`);
      kFactor = Math.round(Number(kRes.rows[0]?.k || 0) * 100) / 100;

      if (dau > 0) arpdau = Math.round((rev / dau) * 100) / 100;
    } catch (err) {
      logger.error('Error in bot report command:', err);
    }
  }

  const reportText = `📊 **NEON ORBIT // ADMIN METRICS REPORT**\n\n` +
    `• **DAU (Daily Active Users):** \`${dau}\`\n` +
    `• **WAU (Weekly Active Users):** \`${wau}\`\n` +
    `• **Retention (D1/D7/D30):** \`N/A\`\n` +
    `• **Total Rounds Played:** \`${rounds}\`\n` +
    `• **K-Factor (Viral Coefficient):** \`${kFactor}\`\n` +
    `• **Stars Revenue:** \`${rev} ⭐\`\n` +
    `• **ARPDAU:** \`${arpdau} ⭐\`\n\n` +
    `🚀 *System status: All hyper-drives nominal.*`;

  await ctx.reply(reportText, { parse_mode: 'Markdown' });
});

// Handle /season command
bot.command('season', async (ctx: Context) => {
  const userId = ctx.from?.id;
  let seasonInfo = 'Active Season: Neon Storm\nStatus: Running (Ends in 14 days)\nRewards: Top 100 get Fleet Admiral titles & Stardust!';
  if (userId && isDbActive()) {
    try {
      const sRes = await query(`SELECT title_en, ends_at FROM seasons WHERE is_active = TRUE LIMIT 1`);
      if (sRes.rows.length > 0) {
        const s = sRes.rows[0];
        const uRes = await query(`SELECT score, season_points, rank_title FROM season_scores WHERE season_id = (SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1) AND user_id = $1`, [userId]);
        const userStat = uRes.rows[0];
        if (userStat) {
          seasonInfo = `🌌 **Active Season:** \`${s.title_en}\`\n⏳ **Ends:** \`${new Date(s.ends_at).toLocaleDateString()}\`\n\n🏆 **Your Season Stats:**\n• **Score:** \`${userStat.score}\`\n• **Season Points:** \`${userStat.season_points}\`\n• **Rank Title:** \`${userStat.rank_title}\``;
        } else {
          seasonInfo = `🌌 **Active Season:** \`${s.title_en}\`\n⏳ **Ends:** \`${new Date(s.ends_at).toLocaleDateString()}\`\n\nPlay rounds in the app to join the season leaderboard!`;
        }
      }
    } catch (err) {
      logger.error('Error in /season command:', err);
    }
  }
  const keyboard = new InlineKeyboard().webApp('🚀 Open Season Pass', APP_URL);
  await ctx.reply(seasonInfo, { parse_mode: 'Markdown', reply_markup: keyboard });
});

// Handle /help command
bot.command('help', async (ctx: Context) => {
  const ru = isRu(ctx);
  const helpText = ru
    ? `🎮 **Гайд для пилотов Neon Orbit**\n\n` +
      `• **Цель:** Тапай по целям за 45 секунд раунда и набирай рекордные очки.\n` +
      `• **Золотые маяки:** Дают +1,000 очков и заряжают Гиперрежим!\n` +
      `• **Красные мины:** Сбивают множитель и серию комбо. Щит защищает корабль.\n` +
      `• **Золотой час:** Каждый день с 18:00 до 19:00 UTC даёт удвоенный множитель x2!\n` +
      `• **Косметика и Звёзды:** Открывай уникальные корабли и скины за Звёздную пыль или Telegram Stars (⭐).\n\n` +
      `**Команды:**\n` +
      `/start — Запуск игры\n` +
      `/top — Таблица лидеров\n` +
      `/help — Гайд и правила\n` +
      `/paysupport — Поддержка оплат Stars\n` +
      `/privacy — Конфиденциальность\n` +
      `/delete_me — Удаление данных (GDPR)`
    : `🎮 **Neon Orbit Pilot Guide**\n\n` +
      `• **Objective:** Tap targets during 45-second orbital rounds to maximize high scores.\n` +
      `• **Golden Beacons:** Grant +1,000 PTS and charge Hypermode.\n` +
      `• **Mines (Red):** Reduce multiplier & streak! Active Shield protects your ship.\n` +
      `• **Golden Hour Surge:** Daily 18:00–19:00 UTC grants x2 score multiplier!\n` +
      `• **Cosmetics & Stars:** Purchase exclusive ships and streak shields using Stardust or Telegram Stars (XTR).\n\n` +
      `**Commands:**\n` +
      `/start - Launch Mini App\n` +
      `/top - View leaderboard\n` +
      `/help - Pilot guide\n` +
      `/paysupport - Payment support\n` +
      `/privacy - Privacy policy\n` +
      `/delete_me - Erase personal data`;

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// Handle /notifications command
bot.command('notifications', async (ctx: Context) => {
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  if (!userId || !isDbActive()) {
    await ctx.reply(ru ? 'Уведомления доступны в игре.' : 'Notifications are available in the game.');
    return;
  }

  const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
  const enabled = userRes.rows[0]?.notifications_enabled ?? true;

  const text = ru
    ? `🔔 **Настройки уведомлений Neon Orbit**\n\nСтатус: ${enabled ? '🟢 Включены' : '🔴 Выключены'}\n\nВы получаете напоминания о стриках, событиях и рекордах друзей (не более 1-2 в день).`
    : `🔔 **Neon Orbit Notification Settings**\n\nStatus: ${enabled ? '🟢 Enabled' : '🔴 Disabled'}\n\nYou receive reminders about streaks, events, and friend records (max 1-2 per day).`;

  const keyboard = new InlineKeyboard()
    .text(
      enabled ? (ru ? '🔕 Отключить уведомления' : '🔕 Disable Notifications') : (ru ? '🔔 Включить уведомления' : '🔔 Enable Notifications'),
      `toggle_notif_${userId}`
    );

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
});

bot.callbackQuery(/toggle_notif_(\d+)/, async (ctx: Context) => {
  const userId = Number(ctx.match?.[1]);
  if (!userId || userId !== ctx.from?.id) {
    await ctx.answerCallbackQuery({ text: 'Unauthorized' });
    return;
  }

  const userRes = await query(`SELECT notifications_enabled FROM users WHERE id = $1`, [userId]);
  const current = userRes.rows[0]?.notifications_enabled ?? true;
  const next = !current;

  await query(`UPDATE users SET notifications_enabled = $1 WHERE id = $2`, [next, userId]);
  const ru = isRu(ctx);

  await ctx.answerCallbackQuery({ text: next ? 'Notifications enabled' : 'Notifications disabled' });
  await ctx.editMessageText(
    ru
      ? `🔔 **Настройки уведомлений Neon Orbit**\n\nСтатус: ${next ? '🟢 Включены' : '🔴 Выключены'}`
      : `🔔 **Neon Orbit Notification Settings**\n\nStatus: ${next ? '🟢 Enabled' : '🔴 Disabled'}`,
    {
      parse_mode: 'Markdown',
      reply_markup: new InlineKeyboard().text(
        next ? (ru ? '🔕 Отключить уведомления' : '🔕 Disable Notifications') : (ru ? '🔔 Включить уведомления' : '🔔 Enable Notifications'),
        `toggle_notif_${userId}`
      ),
    }
  );
});

bot.callbackQuery(/unsub_(\d+)/, async (ctx: Context) => {
  const userId = Number(ctx.match?.[1]);
  if (!userId) {
    await ctx.answerCallbackQuery({ text: 'Invalid' });
    return;
  }

  await query(`UPDATE users SET notifications_enabled = FALSE WHERE id = $1`, [userId]);
  await ctx.answerCallbackQuery({ text: 'Unsubscribed successfully' });
  await ctx.editMessageText('🔕 **Вы успешно отписались от уведомлений Neon Orbit.**\n\nВы всегда можете включить их обратно командой /notifications.', { parse_mode: 'Markdown' });
});

// Mandatory Telegram Stars Support Command
bot.command('paysupport', async (ctx: Context) => {
  const userId = ctx.from?.id || 'Unknown';
  const ru = isRu(ctx);

  const supportText = ru
    ? `💬 **Поддержка платежей Neon Orbit (Telegram Stars)**\n\nПо любым вопросам, возвратам или проблемам с покупками за Telegram Stars (⭐ XTR) обращайтесь:\n\n• **Поддержка Telegram:** @NeonOrbitSupport\n• **Email:** support@neonorbit.app\n• **Ваш User ID:** \`${userId}\`\n\nПожалуйста, укажите Telegram Payment Charge ID при обращении.`
    : `💬 **Neon Orbit Payment & Stars Support**\n\nFor any questions, refund requests, or issues regarding Telegram Stars (XTR) purchases, please contact our support team:\n\n• **Support Telegram:** @NeonOrbitSupport\n• **Email:** support@neonorbit.app\n• **Your User ID:** \`${userId}\`\n\nPlease include your Telegram payment charge ID when requesting assistance.`;

  await ctx.reply(supportText, { parse_mode: 'Markdown' });
});

// Privacy Command
bot.command('privacy', async (ctx: Context) => {
  const ru = isRu(ctx);
  const text = ru
    ? `🔒 **Политика конфиденциальности Neon Orbit**\n\n• Мы храним технические метаданные Telegram (ID пользователя, юзернейм, имя), необходимые для игрового процесса, рейтинга и инвентаря.\n• Вы можете в любой момент скрыть себя из публичных рейтингов в Настройках игры.\n• Платежи безопасно проводятся через официальный шлюз Telegram Stars (XTR).\n• Для полного удаления всех персональных данных отправьте команду \`/delete_me\`.`
    : `🔒 **Neon Orbit Privacy Policy**\n\n• We store Telegram metadata (user ID, username, first name) required for gameplay, rankings, and inventory.\n• You can toggle "Hide me from leaderboards" anytime in Game Settings.\n• Payments are processed via official Telegram Stars (XTR).\n• To permanently erase your account and data, use \`/delete_me\`.`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// Text message fallback handler (e.g. user sends any message)
bot.on('message:text', async (ctx: Context) => {
  const text = ctx.message?.text || '';
  if (text.startsWith('/')) return; // Commands are handled by command handlers

  const ru = isRu(ctx);
  const playUrl = ctx.chat?.id ? `${APP_URL}?chat_id=${ctx.chat.id}` : APP_URL;
  const buttonText = ru ? '🎮 ИГРАТЬ В NEON ORBIT' : '🎮 PLAY NEON ORBIT';
  const keyboard = new InlineKeyboard().webApp(buttonText, playUrl);

  const replyText = ru
    ? `🛸 **Готов к взлёту в Neon Orbit?**\n\nНажми кнопку ниже, чтобы запустить игру и набрать очки!`
    : `🛸 **Ready to launch Neon Orbit?**\n\nTap the button below to start your 45-second round and shatter records!`;

  await ctx.reply(replyText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});



// Inline Query Handler for score card sharing
bot.on('inline_query', async (ctx: Context) => {
  const queryText = ctx.inlineQuery?.query || '';
  const score = queryText ? parseInt(queryText, 10) || 12400 : 12400;

  const result = InlineQueryResultBuilder.article('share_score_card', '🚀 Share Neon Orbit Score Card', {
    description: `Challenge friends with high score of ${score.toLocaleString()} PTS!`,
    reply_markup: new InlineKeyboard().webApp('⚔️ ACCEPT CHALLENGE', `${APP_URL}?challenge=${Date.now()}`),
  }).text(`🛸 **NEON ORBIT HIGH SCORE: ${score.toLocaleString()} PTS**\n\nCan you beat my 45-second orbital score? Tap below to launch your starfighter on the exact same target seed!`, {
    parse_mode: 'Markdown',
  });

  await ctx.answerInlineQuery([result], { cache_time: 10 });
});

// Handle Telegram Stars Pre-Checkout Query
bot.on('pre_checkout_query', async (ctx: Context) => {
  const preCheckout = ctx.preCheckoutQuery;
  if (!preCheckout) {
    return ctx.answerPreCheckoutQuery(false, { error_message: 'Invalid pre-checkout payload' });
  }

  const rawPayload = preCheckout.invoice_payload;
  const totalAmount = preCheckout.total_amount;
  const currency = preCheckout.currency;
  const userId = ctx.from?.id;
  const correlationId = `prechk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  logger.info(`[PRE-CHECKOUT] Processing pre-checkout query for user ${userId}, currency ${currency}, amount ${totalAmount}`, { correlationId, userId });

  // 1. Strict Currency check
  if (currency !== 'XTR') {
    logger.warn(`[PRE-CHECKOUT REJECTED] Unsupported currency: ${currency}`, { correlationId });
    return ctx.answerPreCheckoutQuery(false, { error_message: 'Invalid currency. Only Telegram Stars (XTR) accepted.' });
  }

  // 2. Fail-safe DB Availability Check in production
  if (!isDbActive()) {
    if (config.nodeEnv === 'production' || !config.mockModeAllowed) {
      logger.error(`[PRE-CHECKOUT REJECTED] Database unavailable in production. Cannot verify order.`, { correlationId });
      return ctx.answerPreCheckoutQuery(false, { error_message: 'Payment service temporarily unavailable. Please try again shortly.' });
    }
  }

  try {
    let paymentId = rawPayload;
    let payloadUserId: any = null;
    let payloadItemId: any = null;

    try {
      const parsed = JSON.parse(rawPayload);
      paymentId = parsed.paymentId || rawPayload;
      payloadUserId = parsed.userId;
      payloadItemId = parsed.itemId;
    } catch {
      // rawPayload is paymentId string
    }

    if (!paymentId) {
      logger.warn(`[PRE-CHECKOUT REJECTED] Missing paymentId in payload`, { correlationId });
      return ctx.answerPreCheckoutQuery(false, { error_message: 'Invalid payment order identification.' });
    }

    if (isDbActive()) {
      const res = await query(
        `SELECT id, user_id, item_id, stars_amount, status FROM payments WHERE id = $1`,
        [paymentId]
      );

      if (res.rows.length === 0) {
        logger.warn(`[PRE-CHECKOUT REJECTED] Order ${paymentId} not found in database`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: 'Payment order expired or not found.' });
      }

      const payment = res.rows[0];

      // Strict user ownership check
      if (String(payment.user_id) !== String(userId)) {
        logger.error(`[PRE-CHECKOUT SECURITY ALERT] User mismatch: order belongs to ${payment.user_id}, attempted by ${userId}`, { correlationId, orderId: paymentId });
        return ctx.answerPreCheckoutQuery(false, { error_message: 'User account mismatch for payment.' });
      }

      // Strict status check: MUST be 'created' (cannot be 'paid' or 'refunded')
      if (payment.status !== 'created') {
        logger.warn(`[PRE-CHECKOUT REJECTED] Order ${paymentId} already processed (status: ${payment.status})`, { correlationId });
        if (payment.status === 'paid') {
          return ctx.answerPreCheckoutQuery(false, { error_message: 'This invoice has already been paid and fulfilled.' });
        }
        return ctx.answerPreCheckoutQuery(false, { error_message: 'Payment order is no longer valid.' });
      }

      const catalogItem = getStarsCatalogItem(payment.item_id);
      if (!catalogItem) {
        logger.error(`[PRE-CHECKOUT REJECTED] Item ${payment.item_id} no longer exists in catalog`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: 'Item no longer exists in catalog.' });
      }

      // Strict price and amount check
      if (catalogItem.priceStars !== totalAmount || Number(payment.stars_amount) !== totalAmount) {
        logger.error(`[PRE-CHECKOUT SECURITY ALERT] Amount mismatch: catalog=${catalogItem.priceStars}, order=${payment.stars_amount}, total=${totalAmount}`, { correlationId });
        return ctx.answerPreCheckoutQuery(false, { error_message: 'Price mismatch for requested item.' });
      }
    } else {
      // Mock mode fallback when DB is inactive in dev/test
      if (payloadItemId) {
        const catalogItem = getStarsCatalogItem(payloadItemId);
        if (!catalogItem || catalogItem.priceStars !== totalAmount) {
          return ctx.answerPreCheckoutQuery(false, { error_message: 'Invalid item or price mismatch.' });
        }
      }
      if (payloadUserId && String(payloadUserId) !== String(userId)) {
        return ctx.answerPreCheckoutQuery(false, { error_message: 'User account mismatch for payment.' });
      }
    }

    logger.info(`[PRE-CHECKOUT APPROVED] Order ${paymentId} validated successfully for user ${userId}`, { correlationId });
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    logger.error('[PRE_CHECKOUT EXCEPTION]', { correlationId, error: err instanceof Error ? err.message : String(err) });
    await ctx.answerPreCheckoutQuery(false, { error_message: 'Internal error validating payment. Please try again.' });
  }
});

// Handle Successful Telegram Stars Payment
bot.on('message:successful_payment', async (ctx: Context) => {
  const payment = ctx.message?.successful_payment;
  const chargeId = payment?.telegram_payment_charge_id;
  const rawPayload = payment?.invoice_payload;
  const totalAmount = payment?.total_amount || 0;
  const currency = payment?.currency || 'XTR';
  const userId = ctx.from?.id;
  const ru = isRu(ctx);
  const correlationId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  logger.info(`[PAYMENT RECEIVED] Incoming payment for user ${userId}, charge ${chargeId}, amount ${totalAmount} ${currency}`, { correlationId, chargeId });

  let paymentId = rawPayload || '';
  let payloadItemId = '';
  try {
    const parsed = JSON.parse(rawPayload || '{}');
    paymentId = parsed.paymentId || rawPayload || '';
    payloadItemId = parsed.itemId || '';
  } catch {
    // string paymentId
  }

  if (!chargeId || !paymentId) {
    logger.error(`[PAYMENT ERROR] Missing charge ID or payment ID in successful_payment`, { correlationId });
    await ctx.reply(
      ru
        ? `⚠️ **Внимание:** Платёж зафиксирован, но данные заказа повреждены. Обратитесь в поддержку /paysupport с номером операции: \`${chargeId || 'N/A'}\`.`
        : `⚠️ **Notice:** Payment recorded, but order payload is missing. Please contact /paysupport with charge ID: \`${chargeId || 'N/A'}\`.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let fulfillmentResult: any;
  try {
    fulfillmentResult = await fulfillPayment(paymentId, chargeId, {
      expectedUserId: userId,
      expectedAmount: totalAmount,
      expectedCurrency: currency,
    });
  } catch (err: any) {
    logger.error(`[PAYMENT EXECUTION EXCEPTION] Fulfillment threw error: ${err?.message || err}`, { correlationId, paymentId });
    fulfillmentResult = { success: false, error: err?.message || 'FULFILLMENT_EXCEPTION' };
  }

  if (fulfillmentResult.success) {
    logger.info(`[PAYMENT FULFILLED] Order ${paymentId} fulfilled successfully with charge ${chargeId}`, { correlationId, alreadyPaid: fulfillmentResult.alreadyPaid });
    
    // Confirmed delivery message
    const confirmedText = ru
      ? `✨ **Оплата прошла успешно!** Получено ${totalAmount} Stars (⭐ XTR).\n\nНомер транзакции: \`${chargeId}\`.\nТовар успешно разблокирован! Запустите игру для просмотра обновленного Ангара и баланса Звёздной пыли. 🚀`
      : `✨ **Payment Successful!** Received ${totalAmount} Stars (XTR).\n\nTransaction Charge ID: \`${chargeId}\`.\nYour item has been unlocked! Launch the game to view your updated Hangar and Stardust balance. 🚀`;

    await ctx.reply(confirmedText, { parse_mode: 'Markdown' });
  } else {
    // Delivery could NOT be confirmed immediately
    logger.error(`[PAYMENT FULFILLMENT FAILED] Order ${paymentId} failed: ${fulfillmentResult.error}. Enqueueing reconciliation...`, { correlationId, chargeId, error: fulfillmentResult.error });

    // Enqueue into durable reconciliation queue to ensure safe recovery without event loss
    await enqueuePaymentReconciliation(paymentId, chargeId, {
      userId,
      starsAmount: totalAmount,
      itemId: payloadItemId,
      error: fulfillmentResult.error,
      correlationId,
    });

    // Notify user of delay without falsely stating item is unlocked
    const delayNotice = ru
      ? `⏳ **Платёж получен, выдача в обработке!**\n\nTelegram подтвердил списание ${totalAmount} ⭐ (ID: \`${chargeId}\`).\nИз-за временной задержки синхронизации с базой данных начисление предмета выполняется в автоматической очереди восстановления.\n\nПредмет станет доступен в игре в течение 1–2 минут. Команда поддержки: /paysupport.`
      : `⏳ **Payment received, delivery in progress!**\n\nTelegram confirmed your payment of ${totalAmount} Stars (ID: \`${chargeId}\`).\nDue to temporary database synchronization latency, your item is being delivered via our automatic reconciliation queue.\n\nYour item will appear in your account within 1–2 minutes. For assistance, use /paysupport.`;

    await ctx.reply(delayNotice, { parse_mode: 'Markdown' });
  }
});

// Admin Refund Command: /refund <user_id> <telegram_payment_charge_id>
bot.command('refund', async (ctx: Context) => {
  const fromUserId = String(ctx.from?.id || '');

  const isAdmin = config.adminTelegramIds.some((adminId) => String(adminId) === fromUserId);
  if (!isAdmin) {
    return ctx.reply('❌ **Unauthorized:** Admin authorization required to issue refunds.', { parse_mode: 'Markdown' });
  }

  const matchStr = typeof ctx.match === 'string' ? ctx.match : '';
  const [userIdStr, chargeId] = matchStr.split(' ');

  if (!userIdStr || !chargeId) {
    return ctx.reply('Usage: `/refund <user_id> <telegram_payment_charge_id>`', { parse_mode: 'Markdown' });
  }

  try {
    const userId = Number(userIdStr);
    await ctx.api.refundStarPayment(userId, chargeId);
    const refundRes = await refundPayment(userId, chargeId);

    if (refundRes.success) {
      await ctx.reply(`✅ **Refund Successful!** Refunded charge \`${chargeId}\` for user \`${userId}\` and revoked item from inventory.`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`⚠️ Telegram refund issued, but database status update failed: ${refundRes.error}`, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    logger.error('Refund error:', err);
    await ctx.reply(`❌ **Refund Failed:** ${err instanceof Error ? err.message : 'Unknown error'}`, { parse_mode: 'Markdown' });
  }
});

/**
 * Setup Telegram Bot inside Express app
 * Configures Telegram Commands, WebApp Menu Button, Descriptions, and launches active long-polling.
 */
export async function setupTelegramBot(app: express.Application): Promise<void> {
  if (!token || token.startsWith('111111111:')) {
    logger.warn('TELEGRAM_BOT_TOKEN missing or placeholder. Bot startup skipped.');
    return;
  }

  // 1. Informational route for webhook status
  app.all('/telegram/webhook', (_req, res) => {
    res.json({ status: 'polling_mode', bot: BOT_USERNAME });
  });

  // 2. Ensure Telegram delivers updates via getUpdates by clearing webhook
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    logger.info('Telegram webhook cleared for active long-polling mode.');
  } catch (err: any) {
    logger.info('deleteWebhook notice (non-fatal):', err?.message || err);
  }

  // 3. Register Bot Commands in Telegram Menu
  try {
    await bot.api.setMyCommands([
      { command: 'start', description: '🎮 Запустить игру Neon Orbit' },
      { command: 'top', description: '🏆 Таблица лидеров' },
      { command: 'notifications', description: '🔔 Настройки уведомлений' },
      { command: 'help', description: '📖 Инструкция и правила игры' },
      { command: 'paysupport', description: '⭐ Поддержка Telegram Stars' },
      { command: 'privacy', description: '🔒 Политика конфиденциальности' },
      { command: 'delete_me', description: '🗑️ Удалить аккаунт (GDPR)' },
    ]);
    logger.info('Telegram Bot commands registered.');
  } catch (err: any) {
    logger.info('setMyCommands notice (non-fatal):', err?.message || err);
  }

  // 4. Configure Chat Menu Button to launch the Neon Orbit Mini App
  try {
    await bot.api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🎮 Играть',
        web_app: { url: APP_URL },
      },
    });
    logger.info(`Telegram Bot Menu Button linked to WebApp URL: ${APP_URL}`);
  } catch (err: any) {
    logger.info('setChatMenuButton notice (non-fatal):', err?.message || err);
  }

  // 5. Configure Bot Descriptions
  try {
    await bot.api.setMyShortDescription('🚀 Ретро 80-е синтвейв аркада-кликер прямо в Telegram! Собирай комбо, бей рекорды и открывай космические корабли!');
    await bot.api.setMyDescription('🛸 Добро пожаловать в Neon Orbit!\n\n45-секундная космическая ретро-аркада в стиле 80s Synthwave.\n\n✨ Быстрые динамичные раунды\n⚡ Комбо-множители и гиперрежим\n🚀 Кастомизация кораблей в ангаре\n🏆 Глобальные и чат-рейтинги\n⭐ Telegram Stars и эксклюзивные скины\n\nНажми «🎮 Играть» или команду /start для старта!');
  } catch (err: any) {
    logger.info('setMyDescription notice (non-fatal):', err?.message || err);
  }

  // 6. Launch Long-Polling Runner
  bot.start({
    drop_pending_updates: false,
    onStart: (botInfo) => {
      logger.info(`🚀 Telegram Bot @${botInfo.username} (ID: ${botInfo.id}) is ACTIVE and listening for updates!`);
    },
  }).catch((err: any) => {
    const isConflict = err?.error_code === 409 ||
      (typeof err?.message === 'string' && (err.message.includes('409') || err.message.includes('terminated by setWebhook request')));

    if (isConflict) {
      logger.info('Telegram Bot polling yielded to an active conflict.');
    } else {
      logger.warn('Telegram Bot long-polling error:', err?.message || err);
    }
  });
}
