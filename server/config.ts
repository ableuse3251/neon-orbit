import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const rawBotToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const botToken = rawBotToken.trim().replace(/^["']|["']$/g, '');
const jwtSecret = process.env.JWT_SECRET || (botToken ? `jwt_${botToken.slice(-12)}` : 'default_jwt_secret_change_me');
const webhookSecret = process.env.WEBHOOK_SECRET || (botToken ? `wh_${botToken.slice(-12)}` : 'default_webhook_secret');
const metricsSecret = process.env.METRICS_SECRET || (botToken ? `m_${botToken.slice(-12)}` : 'default_metrics_secret');
const databaseUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

export function parseAllowedOrigins(input?: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const DEFAULT_TELEGRAM_ORIGINS = [
  'https://telegram.org',
  'https://web.telegram.org',
  'https://webk.telegram.org',
  'https://webz.telegram.org',
];

export function getEffectiveAllowedOrigins(cfg: { appUrl?: string; corsOrigin?: string[]; allowedOrigins?: string[] }): string[] {
  const configured = cfg.corsOrigin || cfg.allowedOrigins || [];
  const origins = new Set<string>();

  if (cfg.appUrl && cfg.appUrl.trim()) {
    origins.add(cfg.appUrl.trim());
  }

  for (const o of configured) {
    if (o && o.trim()) {
      origins.add(o.trim());
    }
  }

  for (const tg of DEFAULT_TELEGRAM_ORIGINS) {
    origins.add(tg);
  }

  return Array.from(origins);
}

// Canonical variable is CORS_ORIGIN, with backward-compatible fallback to ALLOWED_ORIGINS
const rawOrigins = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = parseAllowedOrigins(rawOrigins);

export function extractDbHostname(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.toLowerCase();
  } catch {
    const match = urlStr.match(/@([^:/]+)/);
    return match ? match[1].toLowerCase() : '';
  }
}

export const INTERNAL_DB_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'pgbouncer',
  'postgres',
  'redis',
  'host.docker.internal',
]);

export function isInternalDatabaseHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return (
    INTERNAL_DB_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.docker')
  );
}

export function validateProductionConfig(cfg: Partial<typeof config>) {
  if (cfg.nodeEnv === 'production') {
    if (cfg.devAuthBypass) {
      throw new Error('CRITICAL CONFIGURATION ERROR: DEV_AUTH_BYPASS is strictly forbidden in production.');
    }
    const isSupabase = cfg.databaseUrl && (cfg.databaseUrl.includes('supabase.com') || cfg.databaseUrl.includes('supabase.co'));
    if (cfg.dbSslRejectUnauthorized === false && !isSupabase) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Disabling SSL certificate validation (DB_SSL_REJECT_UNAUTHORIZED=false) is forbidden in production.');
    }
    if (cfg.dockerLocalDb) {
      const hostname = extractDbHostname(cfg.databaseUrl);
      if (hostname && !isInternalDatabaseHost(hostname)) {
        throw new Error(`CRITICAL CONFIGURATION ERROR: DOCKER_LOCAL_DB is only permitted for local/internal database hosts (e.g. pgbouncer, postgres, localhost). Remote database host "${hostname}" must use standard TLS verification.`);
      }
    } else if (cfg.dbSsl === false) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Disabling database SSL (DB_SSL=false) is forbidden in production unless running in a validated internal Docker environment with DOCKER_LOCAL_DB=true.');
    }
    if (!cfg.jwtSecret || cfg.jwtSecret === 'default_jwt_secret_change_me') {
      throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty JWT_SECRET is forbidden in production.');
    }
    if (!cfg.webhookSecret || cfg.webhookSecret === 'default_webhook_secret') {
      throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty WEBHOOK_SECRET is forbidden in production.');
    }
    if (!cfg.metricsSecret || cfg.metricsSecret === 'default_metrics_secret') {
      throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty METRICS_SECRET is forbidden in production.');
    }
    if (!cfg.databaseUrl) {
      throw new Error('CRITICAL CONFIGURATION ERROR: DATABASE_URL is required in production.');
    }
    if (!cfg.botToken || cfg.botToken.startsWith('111111111:')) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Valid TELEGRAM_BOT_TOKEN is required in production.');
    }
    if (cfg.mockModeAllowed) {
      throw new Error('CRITICAL CONFIGURATION ERROR: Mock mode is strictly forbidden in production.');
    }
  }
}

export const config = {
  port: Number(process.env.PORT) || Number(process.env.APP_PORT) || 3000,
  nodeEnv,
  botToken,
  botUsername: process.env.BOT_USERNAME || 'Neon_orbitbot',
  devAuthBypass: nodeEnv === 'production' ? false : (process.env.DEV_AUTH_BYPASS === 'true'),
  mockModeAllowed: nodeEnv === 'production' ? false : (process.env.ENABLE_MOCK_GAME === 'true' || nodeEnv !== 'production'),
  appUrl: process.env.APP_URL || '',
  corsOrigin: allowedOrigins,
  allowedOrigins,
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  databaseUrl,
  dockerLocalDb: process.env.DOCKER_LOCAL_DB === 'true' || process.env.DOCKER_INTERNAL_DB === 'true' || process.env.ALLOW_INTERNAL_DOCKER_DB === 'true',
  dbSsl: process.env.DB_SSL !== 'false' && process.env.DB_SSL_MODE !== 'disable',
  dbSslCa: process.env.PG_CA_CERT || process.env.DB_SSL_CA || '',
  dbSslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret,
  webhookSecret,
  metricsSecret,
  telegramInitDataMaxAgeSeconds: Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS) || 7200,
};

export const configErrors: string[] = [];

if (config.nodeEnv === 'production') {
  try {
    validateProductionConfig(config);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    configErrors.push(errMsg);
    console.error('CRITICAL PRODUCTION CONFIGURATION WARNING:', errMsg);
  }
}

