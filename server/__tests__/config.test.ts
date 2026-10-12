import { describe, it, expect } from 'vitest';
import { config } from '../config.js';

describe('Production Configuration Hardening Tests (F21 / NE-15 / NE-29)', () => {
  it('verifies that essential production configuration is loaded', () => {
    // In production, botToken MUST be present as checked in server.ts startup
    if (config.nodeEnv === 'production') {
      expect(config.botToken).toBeDefined();
      expect(config.botToken!.length).toBeGreaterThan(0);
      expect(config.databaseUrl).toBeDefined();
    }
  });

  it('ensures sensible defaults for non-sensitive config', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(typeof config.nodeEnv).toBe('string');
  });
});
