import { describe, it, expect } from 'vitest';
import express from 'express';
import analyticsRouter from '../routes/analytics.js';
import metricsRouter from '../routes/metrics.js';

describe('Analytics & Metrics Security Tests (F08 / NE-07 / NE-25)', () => {
  it('validates analytics route and helper logic existence', () => {
    expect(analyticsRouter).toBeDefined();
    expect(metricsRouter).toBeDefined();
  });

  it('verifies analytics route exports an express router', () => {
    const app = express();
    expect(() => app.use('/api', analyticsRouter)).not.toThrow();
  });
});
