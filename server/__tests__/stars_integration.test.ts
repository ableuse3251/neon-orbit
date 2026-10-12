import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fulfillPayment, refundPayment } from '../routes/stars.js';
import * as db from '../db.js';

vi.mock('../db.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    query: vi.fn(),
    transaction: vi.fn(async (callback) => {
      const mockClient = {
        query: vi.fn(),
      };
      return await callback(mockClient);
    }),
    isDbActive: vi.fn(() => true),
  };
});

describe('Telegram Stars Payment Lifecycle Integration Tests (F30 / Stars Audit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fulfills payment successfully and grants rewards idempotently', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row for update
        .mockResolvedValueOnce({
          rows: [{
            id: 'pay_test_1',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'created',
            telegram_payment_charge_id: null
          }]
        })
        // 2. Check existing charge id
        .mockResolvedValueOnce({ rows: [] })
        // 3. UPDATE payments set status = 'paid'
        .mockResolvedValueOnce({ rowCount: 1 })
        // 4. UPDATE wallets stardust
        .mockResolvedValueOnce({ rowCount: 1 })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_test_1', 'charge_abc_123');
    expect(result.success).toBe(true);
    expect(result.alreadyPaid).toBeFalsy();
  });

  it('prevents false confirmation and rejects cross-payment charge ID reuse', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row for update (payment B)
        .mockResolvedValueOnce({
          rows: [{
            id: 'pay_test_2',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'created',
            telegram_payment_charge_id: null
          }]
        })
        // 2. Check existing charge id -> found on another payment pay_test_1!
        .mockResolvedValueOnce({
          rows: [{ id: 'pay_test_1' }]
        })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_test_2', 'charge_abc_123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('CHARGE_ID_ALREADY_USED_BY_ANOTHER_PAYMENT');
  });

  it('handles idempotent webhook retry for same payment and charge id', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row -> already paid
        .mockResolvedValueOnce({
          rows: [{
            id: 'pay_test_1',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'paid',
            telegram_payment_charge_id: 'charge_abc_123'
          }]
        })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_test_1', 'charge_abc_123');
    expect(result.success).toBe(true);
    expect(result.alreadyPaid).toBe(true);
  });

  it('processes refund and revokes items safely', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment for refund
        .mockResolvedValueOnce({
          rows: [{
            id: 'pay_test_1',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            status: 'paid'
          }]
        })
        // 2. UPDATE payments status = refunded
        .mockResolvedValueOnce({ rowCount: 1 })
        // 3. UPDATE wallets stardust
        .mockResolvedValueOnce({ rowCount: 1 })
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await refundPayment(1001, 'charge_abc_123');
    expect(result.success).toBe(true);
  });
});
