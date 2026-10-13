import { describe, it, expect } from 'vitest';
import { getStarsCatalogItem, STARS_CATALOG } from '../../src/shared/stars-catalog.js';
import { fulfillPayment, refundPayment } from '../routes/stars.js';
import { config } from '../config.js';

describe('Telegram Stars (XTR) Economy & Anti-Tampering', () => {
  it('validates server-authoritative catalog pricing and items', () => {
    // 1. Valid item lookup
    const item = getStarsCatalogItem('stardust_vault_2500');
    expect(item).toBeDefined();
    expect(item?.priceStars).toBe(75);
    expect(item?.rewardStardustBonus).toBe(2500);

    // 2. Ships in catalog
    const ship = getStarsCatalogItem('skin_plasma_crusher');
    expect(ship).toBeDefined();
    expect(ship?.priceStars).toBe(100);
    expect(ship?.type).toBe('skin');

    // 3. Streak shield
    const shield = getStarsCatalogItem('streak_shield');
    expect(shield).toBeDefined();
    expect(shield?.priceStars).toBe(50);
  });

  it('rejects forged / tampering item requests not present in catalog', () => {
    const invalidItem = getStarsCatalogItem('hack_999999_stars');
    expect(invalidItem).toBeUndefined();

    const emptyItem = getStarsCatalogItem('');
    expect(emptyItem).toBeUndefined();
  });

  it('verifies that all catalog prices are positive integer amounts in XTR Stars', () => {
    for (const item of STARS_CATALOG) {
      expect(item.id).toBeTruthy();
      expect(item.priceStars).toBeGreaterThan(0);
      expect(Number.isInteger(item.priceStars)).toBe(true);
      expect(item.titleEn).toBeTruthy();
      expect(item.titleRu).toBeTruthy();
    }
  });

  it('forbids payment fulfillment when DB is inactive and mockModeAllowed is false', async () => {
    const originalMockAllowed = config.mockModeAllowed;
    config.mockModeAllowed = false;

    const result = await fulfillPayment('pay_123', 'charge_123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('DATABASE_UNAVAILABLE');

    config.mockModeAllowed = originalMockAllowed;
  });

  it('forbids refund processing when DB is inactive and mockModeAllowed is false', async () => {
    const originalMockAllowed = config.mockModeAllowed;
    config.mockModeAllowed = false;

    const result = await refundPayment(12345, 'charge_123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('DATABASE_UNAVAILABLE');

    config.mockModeAllowed = originalMockAllowed;
  });
});
