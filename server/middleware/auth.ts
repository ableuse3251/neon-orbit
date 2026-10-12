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

  const parsed = parseInitData(initDataStr);
  if (!parsed || !parsed.hash) {
    return { isValid: false, reason: 'Invalid initData format' };
  }

  const { hash, authDate, userObj, urlParams } = parsed;

  // Validate hash format (64-char hex)
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    return { isValid: false, reason: 'Invalid hash format' };
  }

  // Validate auth_date presence and window
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || isNaN(authDate)) {
    return { isValid: false, reason: 'Missing or invalid auth_date' };
  }

  // Check expiration (older than 24 hours) and future date check with 5 min skew tolerance
  if (now - authDate > 86400) {
    return { isValid: false, reason: 'initData expired (older than 24 hours)' };
  }
  if (authDate > now + 300) {
    return { isValid: false, reason: 'initData auth_date is in the future' };
  }

  // Build canonical data_check_string
  const pairs = initDataStr.split('&');
  const keyValuePairs: { key: string; value: string }[] = [];
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    if (key === 'hash') continue;
    keyValuePairs.push({ key, value });
  }

  keyValuePairs.sort((a, b) => a.key.localeCompare(b.key));
  const dataCheckString = keyValuePairs.map(p => `${p.key}=${p.value}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Use timingSafeEqual to prevent timing attacks
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
  let initDataHeader = req.headers['authorization'] || (req.headers['x-init-data'] as string) || (req.query.initData as string) || '';

  if (initDataHeader.startsWith('tma ')) {
    initDataHeader = initDataHeader.slice(4).trim();
  } else if (initDataHeader.startsWith('Bearer ')) {
    initDataHeader = initDataHeader.slice(7).trim();
  }

  req.initDataRaw = initDataHeader;

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
