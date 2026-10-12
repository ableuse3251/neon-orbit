import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'default_jwt_secret_change_me';
const webhookSecret = process.env.WEBHOOK_SECRET || 'default_webhook_secret';

if (nodeEnv === 'production') {
  if (!jwtSecret || jwtSecret === 'default_jwt_secret_change_me') {
    throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty JWT_SECRET is forbidden in production.');
  }
  if (!webhookSecret || webhookSecret === 'default_webhook_secret') {
    throw new Error('CRITICAL CONFIGURATION ERROR: Default or empty WEBHOOK_SECRET is forbidden in production.');
  }
}

export const config = {
  port: Number(process.env.APP_PORT) || 3000,
  nodeEnv,
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  botUsername: process.env.BOT_USERNAME || 'Neon_orbitbot',
  devAuthBypass: process.env.DEV_AUTH_BYPASS === 'true',
  mockModeAllowed: nodeEnv !== 'production' || process.env.ENABLE_MOCK_GAME === 'true',
  appUrl: process.env.APP_URL || '',
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret,
  webhookSecret,
};
