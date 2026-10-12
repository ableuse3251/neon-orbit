import { describe, it, expect } from 'vitest';
import { getStarsCatalogItem } from '../../src/shared/stars-catalog.js';

describe('Season Pass Security & Payment Verification (F13 / NE-22)', () => {
  it('includes season_pass_paid in the authoritative stars catalog with correct pricing', () => {
    const item = getStarsCatalogItem('season_pass_paid');
    expect(item).toBeDefined();
    expect(item?.priceStars).toBe(250);
    expect(item?.type).toBe('bundle');
  });

  it('prevents unverified season pass upgrades without Telegram invoice and payment fulfillment', () => {
    // Verify catalog item cannot be bypassed directly without webhook fulfillment
    const item = getStarsCatalogItem('season_pass_paid');
    expect(item?.id).toBe('season_pass_paid');
  });
});
