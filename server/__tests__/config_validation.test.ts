import { describe, it, expect } from 'vitest';
import { validateProductionConfig } from '../config.js';

describe('Production Configuration Validation & Fail-Fast Tests (F31 / Config Audit)', () => {
  it('passes validation with valid production configuration', () => {
    const validConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_1234567890',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'secure_metrics_secret_1234567890',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
      mockModeAllowed: false,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(validConfig)).not.toThrow();
  });

  it('fails fast when JWT_SECRET is default or missing in production', () => {
    const invalidConfig = {
      nodeEnv: 'production',
      jwtSecret: 'default_jwt_secret_change_me',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'secure_metrics_secret_1234567890',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
      mockModeAllowed: false,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(invalidConfig)).toThrowError(/JWT_SECRET/);
  });

  it('fails fast when DATABASE_URL is missing in production', () => {
    const invalidConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_1234567890',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'secure_metrics_secret_1234567890',
      databaseUrl: '',
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
      mockModeAllowed: false,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(invalidConfig)).toThrowError(/DATABASE_URL/);
  });

  it('fails fast when TELEGRAM_BOT_TOKEN is missing or placeholder in production', () => {
    const invalidConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_1234567890',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'secure_metrics_secret_1234567890',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: '111111111:placeholder',
      mockModeAllowed: false,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(invalidConfig)).toThrowError(/TELEGRAM_BOT_TOKEN/);
  });

  it('fails fast when mock mode is enabled in production', () => {
    const invalidConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_1234567890',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'secure_metrics_secret_1234567890',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
      mockModeAllowed: true,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(invalidConfig)).toThrowError(/Mock mode is strictly forbidden in production/);
  });

  it('fails fast when METRICS_SECRET is default or missing in production', () => {
    const invalidConfig = {
      nodeEnv: 'production',
      jwtSecret: 'secure_jwt_secret_1234567890',
      webhookSecret: 'secure_webhook_secret_1234567890',
      metricsSecret: 'default_metrics_secret',
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
      mockModeAllowed: false,
      port: 3000,
      botUsername: 'bot',
      devAuthBypass: false,
      appUrl: 'https://example.com',
      adminTelegramIds: [],
      redisUrl: '',
    };

    expect(() => validateProductionConfig(invalidConfig)).toThrowError(/METRICS_SECRET/);
  });
});
