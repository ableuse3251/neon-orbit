import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_change_me';
const webhookSecret = process.env.WEBHOOK_SECRET || 'default_webhook_secret';
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

export function validateProductionConfig(cfg: typeof config) {
  if (cfg.nodeEnv === 'production') {
    if (!cfg.jwtSecret || cfg.jwtSecret === 'default_jwt_secret_change_me') {
      throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty JWT_SECRET is forbidden in production.');
    }
    if (!cfg.webhookSecret || cfg.webhookSecret === 'default_webhook_secret') {
      throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty WEBHOOK_SECRET is forbidden in production.');
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
  devAuthBypass: nodeEnv !== 'production' && process.env.DEV_AUTH_BYPASS === 'true',
  mockModeAllowed: nodeEnv === 'production' ? false : (process.env.ENABLE_MOCK_GAME === 'true' || nodeEnv !== 'production'),
  appUrl: process.env.APP_URL || '',
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  databaseUrl,
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret,
  webhookSecret,
};

if (config.nodeEnv === 'production') {
  validateProductionConfig(config);
}

