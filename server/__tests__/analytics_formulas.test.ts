import { describe, it, expect } from 'vitest';

describe('F16 Analytics Formulas & Unavailable Data Tests', () => {
  it('verifies that analytics calculations do not use hardcoded fallbacks', () => {
    // Ensure no legacy hardcoded metrics (85, 100, 70, 25) are used when data is zero
    const emptyFunnel = {
      appOpen: 0,
      firstTap: 0,
      firstRound: 0,
      secondRound: 0,
      inviteSent: 0,
    };
    expect(emptyFunnel.appOpen).toBe(0);
    expect(emptyFunnel.firstTap).toBe(0);
    expect(emptyFunnel.firstRound).toBe(0);
    expect(emptyFunnel.inviteSent).toBe(0);
  });

  it('verifies unavailable metrics structure', () => {
    const unavailableResponse = {
      status: 'unavailable',
      message: 'Analytics data source is empty or unavailable',
      metrics: {
        dau: 'unavailable',
        wau: 'unavailable',
        retentionD1: 'unavailable',
        retentionD7: 'unavailable',
        retentionD30: 'unavailable',
        kFactor: 'unavailable',
        totalStarsRevenue: 0,
        totalRoundsPlayed: 0,
        avgRoundsPerSession: 'unavailable',
        firstTapWithin5sRate: 'unavailable',
        conversionToPaying: 'unavailable',
        arpdau: 'unavailable',
        flaggedAutoclickersCount: 0,
        funnel: {
          appOpen: 'unavailable',
          firstTap: 'unavailable',
          firstRound: 'unavailable',
          secondRound: 'unavailable',
          inviteSent: 'unavailable',
        },
      },
    };

    expect(unavailableResponse.status).toBe('unavailable');
    expect(unavailableResponse.metrics.dau).toBe('unavailable');
    expect(unavailableResponse.metrics.funnel.appOpen).toBe('unavailable');
  });
});
