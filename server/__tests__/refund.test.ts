import { describe, it, expect } from 'vitest';
import { refundPayment } from '../routes/stars.js';
import { config } from '../config.js';

describe('F17 Admin & Provider Refund Workflow Tests (NE-28)', () => {
  it('prevents local reconciliation when DB is inactive or payment not found', async () => {
    const originalMock = config.mockModeAllowed;
    config.mockModeAllowed = false;

    const res = await refundPayment(12345, 'charge_nonexistent');
    expect(res.success).toBe(false);
    expect(res.error).toBe('DATABASE_UNAVAILABLE');

    config.mockModeAllowed = originalMock;
  });

  it('validates refund service function export and signature', () => {
    expect(typeof refundPayment).toBe('function');
  });
});
