import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { query, isDbActive } from '../db.js';

export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  language: string;
  isPremium: boolean;
  isAdmin: boolean;
  isDemo?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      initDataRaw?: string;
    }
  }
}

export function parseInitData(initDataStr: string): { hash: string; authDate: number; userObj: any; urlParams: URLSearchParams } | null {
  try {
    const urlParams = new URLSearchParams(initDataStr);
    const hash = urlParams.get('hash') || '';
    const authDate = Number(urlParams.get('auth_date') || 0);
    const userStr = urlParams.get('user');
    const userObj = userStr ? JSON.parse(userStr) : null;
    return { hash, authDate, userObj, urlParams };
  } catch {
    return null;
  }
}

export function verifyTelegramInitData(initDataStr: string): { isValid: boolean; userObj?: any; reason?: string } {
  if (!initDataStr || !config.botToken) {
    return { isValid: false, reason: 'Missing initData or bot token' };
  }

  let urlParams: URLSearchParams;
  try {
    urlParams = new URLSearchParams(initDataStr);
  } catch {
    return { isValid: false, reason: 'Invalid initData format' };
  }

  const hash = urlParams.get('hash') || '';
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { isValid: false, reason: 'Invalid hash format' };
  }

  const authDateStr = urlParams.get('auth_date');
  if (!authDateStr) {
    return { isValid: false, reason: 'Missing auth_date' };
  }
  const authDate = Number(authDateStr);
  if (isNaN(authDate)) {
    return { isValid: false, reason: 'Invalid auth_date' };
  }

  const now = Math.floor(Date.now() / 1000);
  const maxAgeSeconds = config.telegramInitDataMaxAgeSeconds || 7200;
  if (now - authDate > maxAgeSeconds) {
    return { isValid: false, reason: `initData expired (older than ${maxAgeSeconds} seconds)` };
  }
  if (authDate > now + 300) {
    return { isValid: false, reason: 'initData auth_date is in the future' };
  }

  const userStr = urlParams.get('user');
  let userObj: any = null;
  if (userStr) {
    try {
      userObj = JSON.parse(userStr);
    } catch {
      return { isValid: false, reason: 'Invalid user JSON format' };
    }
  }

  // Build canonical data_check_string according to Telegram Web Apps specification:
  // All received fields (except hash), sorted alphabetically by key, formatted as key=<value> separated by \n.
  // URLSearchParams automatically handles percent-decoding of values.
  const pairs: [string, string][] = [];
  for (const [key, value] of urlParams.entries()) {
    if (key === 'hash') continue;
    pairs.push([key, value]);
  }

  pairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  try {
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const recvBuf = Buffer.from(hash, 'hex');

    if (calcBuf.length !== recvBuf.length || !crypto.timingSafeEqual(calcBuf, recvBuf)) {
      return { isValid: false, reason: 'HMAC signature mismatch' };
    }
  } catch {
    return { isValid: false, reason: 'Hash comparison error' };
  }

  return { isValid: true, userObj };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Reject initData supplied in query parameters to prevent credential leakage in URL logs/proxies
  if (req.query.initData || req.query.init_data || req.query.tgWebAppData) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Passing Telegram initData in query parameters is forbidden. Pass credentials via Authorization header.',
    });
    return;
  }

  let initDataHeader = req.headers['authorization'] || (req.headers['x-init-data'] as string) || '';

  if (typeof initDataHeader === 'string') {
    if (initDataHeader.startsWith('tma ')) {
      initDataHeader = initDataHeader.slice(4).trim();
    } else if (initDataHeader.startsWith('Bearer ')) {
      initDataHeader = initDataHeader.slice(7).trim();
    }
  } else {
    initDataHeader = '';
  }

  req.initDataRaw = '[REDACTED]';

  const verification = verifyTelegramInitData(initDataHeader);

  let userId: number = 0;
  let username = 'Pilot';
  let firstName = 'Pilot';
  let language = 'en';
  let isPremium = false;
  let isDemo = false;

  if (verification.isValid && verification.userObj) {
    userId = Number(verification.userObj.id);
    username = verification.userObj.username || verification.userObj.first_name || 'Pilot';
    firstName = verification.userObj.first_name || 'Pilot';
    language = verification.userObj.language_code || 'en';
    isPremium = !!verification.userObj.is_premium;
  } else {
    // If invalid or missing, allow demo fallback in non-production environments or when devAuthBypass is enabled
    if (config.nodeEnv !== 'production' || config.devAuthBypass) {
      userId = 888777666;
      username = 'synthwave_star';
      firstName = 'RetroPilot';
      language = 'en';
      isPremium = false;
      isDemo = true;
    } else {
      res.status(401).json({
        error: 'Unauthorized',
        message: verification.reason || 'Invalid or missing Telegram initData',
      });
      return;
    }
  }

  const isAdmin = config.adminTelegramIds.includes(String(userId));

  req.user = {
    id: userId,
    username,
    firstName,
    language,
    isPremium,
    isAdmin,
    isDemo,
  };

  // Upsert user into DB upon authenticated access
  if (isDbActive() && userId > 0) {
    try {
      await query(
        `INSERT INTO users (id, username, first_name, language, is_premium, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           language = EXCLUDED.language,
           is_premium = EXCLUDED.is_premium,
           last_seen_at = NOW()`,
        [userId, username, firstName, language, isPremium]
      );

      await query(
        `INSERT INTO wallets (user_id, stardust, xp, level)
         VALUES ($1, 150, 0, 1)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      await query(
        `INSERT INTO equipped (user_id, ship, trail, backdrop, explosion, frame, theme)
         VALUES ($1, 'ship_cyber_wing', 'trail_cyan_beam', 'backdrop_synth_grid', 'exp_retro_burst', 'frame_pilot_steel', 'theme_classic_purple')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );

      await query(
        `INSERT INTO inventory (user_id, item_id, source)
         VALUES 
           ($1, 'ship_cyber_wing', 'default'),
           ($1, 'backdrop_synth_grid', 'default')
         ON CONFLICT (user_id, item_id) DO NOTHING`,
        [userId]
      );
    } catch (err) {
      console.error('Failed to upsert user on requireAuth:', err);
    }
  }

  next();
}
