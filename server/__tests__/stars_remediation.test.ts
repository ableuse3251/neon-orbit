import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fulfillPayment,
  refundPayment,
  enqueuePaymentReconciliation,
  reconcilePendingPayments,
} from '../routes/stars.js';
import * as db from '../db.js';
import { bot } from '../../bot.js';
import { config } from '../config.js';

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

describe('Telegram Stars Payment Remediation Suite (Requirement 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Successful purchase with created status, matching amount, currency, and user
  it('1. successfully fulfills a valid purchase in created status with correct amount and user', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row for update (status: created, amount: 75, user: 1001)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pay_valid_1',
              user_id: 1001,
              item_id: 'stardust_vault_2500',
              stars_amount: 75,
              status: 'created',
              telegram_payment_charge_id: null,
            },
          ],
        })
        // 2. Check global charge id uniqueness
        .mockResolvedValueOnce({ rows: [] })
        // 3. UPDATE payments set status = 'paid'
        .mockResolvedValueOnce({ rowCount: 1 })
        // 4. Grant reward to wallet
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_valid_1', 'charge_valid_100', {
      expectedUserId: 1001,
      expectedAmount: 75,
      expectedCurrency: 'XTR',
    });

    expect(result.success).toBe(true);
    expect(result.alreadyPaid).toBeFalsy();
    // Verify status was transitioned to 'paid' with matching charge ID
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'paid', telegram_payment_charge_id = $1"),
      ['charge_valid_100', 'pay_valid_1']
    );
  });

  // Test 2: Wrong amount rejected
  it('2. rejects payment fulfillment if amount does not match recorded order', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'pay_wrong_amt',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'created',
            telegram_payment_charge_id: null,
          },
        ],
      }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_wrong_amt', 'charge_wrong_amt', {
      expectedUserId: 1001,
      expectedAmount: 50, // Catalog / order is 75, user provided 50!
      expectedCurrency: 'XTR',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('AMOUNT_MISMATCH');
  });

  // Test 3: Foreign order / User mismatch rejected
  it('3. rejects payment fulfillment if order belongs to a different user', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'pay_other_user',
            user_id: 2002, // Owner is 2002
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'created',
            telegram_payment_charge_id: null,
          },
        ],
      }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_other_user', 'charge_user_tamper', {
      expectedUserId: 1001, // Attacker is 1001
      expectedAmount: 75,
      expectedCurrency: 'XTR',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('USER_MISMATCH');
  });

  // Test 4: Replay charge ID across different payment orders rejected
  it('4. rejects charge ID replay across different payment orders', async () => {
    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pay_order_b',
              user_id: 1001,
              item_id: 'stardust_vault_2500',
              stars_amount: 75,
              status: 'created',
              telegram_payment_charge_id: null,
            },
          ],
        })
        // 2. Check if charge ID is already used in DB -> used by pay_order_a
        .mockResolvedValueOnce({
          rows: [{ id: 'pay_order_a', user_id: 1001 }],
        }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_order_b', 'charge_replayed_xyz', {
      expectedUserId: 1001,
      expectedAmount: 75,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('CHARGE_ID_ALREADY_USED_BY_ANOTHER_PAYMENT');
  });

  // Test 5: Re-used invoice link / second charge on already paid order rejected without double fulfillment
  it('5. rejects second charge on an already completed order (invoice reuse attempt)', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'pay_already_paid',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'paid',
            telegram_payment_charge_id: 'charge_first_legit',
          },
        ],
      }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    // Same payment order, but a second/new charge ID comes in!
    const result = await fulfillPayment('pay_already_paid', 'charge_second_duplicate', {
      expectedUserId: 1001,
      expectedAmount: 75,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('ORDER_ALREADY_FULFILLED_WITH_DIFFERENT_CHARGE');
  });

  // Test 5b: Exact idempotent retry of same paymentId and same charge ID succeeds with alreadyPaid
  it('5b. permits exact idempotent webhook replay for identical paymentId and charge ID', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [
          {
            id: 'pay_already_paid',
            user_id: 1001,
            item_id: 'stardust_vault_2500',
            stars_amount: 75,
            status: 'paid',
            telegram_payment_charge_id: 'charge_first_legit',
          },
        ],
      }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    const result = await fulfillPayment('pay_already_paid', 'charge_first_legit', {
      expectedUserId: 1001,
      expectedAmount: 75,
    });

    expect(result.success).toBe(true);
    expect(result.alreadyPaid).toBe(true);
  });

  // Test 6: Database unavailable in production blocks pre-checkout and fulfillment
  it('6. rejects pre-checkout and fulfillment when database is unavailable in production', async () => {
    vi.mocked(db.isDbActive).mockReturnValueOnce(false);
    const originalEnv = config.nodeEnv;
    const originalMock = config.mockModeAllowed;
    config.nodeEnv = 'production';
    config.mockModeAllowed = false;

    const result = await fulfillPayment('pay_offline', 'charge_offline', {
      expectedUserId: 1001,
      expectedAmount: 75,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DATABASE_UNAVAILABLE');

    config.nodeEnv = originalEnv;
    config.mockModeAllowed = originalMock;
  });

  // Test 7: Fulfillment failure saves to reconciliation queue without event loss
  it('7. safely enqueues failed or delayed payments into durable reconciliation queue', async () => {
    vi.mocked(db.query).mockResolvedValueOnce({ rowCount: 1 } as any);

    const enqueueRes = await enqueuePaymentReconciliation('pay_transient_err', 'charge_transient_123', {
      userId: 1001,
      starsAmount: 75,
      itemId: 'stardust_vault_2500',
      error: 'TRANSIENT_DB_TIMEOUT',
    });

    expect(enqueueRes.success).toBe(true);
    expect(enqueueRes.correlationId).toMatch(/^corr_/);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_reconciliation_queue'),
      expect.arrayContaining(['pay_transient_err', 'charge_transient_123'])
    );
  });

  // Test 8: Repeated reconciliation recovers payment when DB restores
  it('8. reconciliation worker recovers pending payments and grants items atomically', async () => {
    // Mock DB claiming row from payment_reconciliation_queue
    vi.mocked(db.query).mockResolvedValueOnce({
      rows: [
        {
          id: 'rec_uuid_1',
          payment_id: 'pay_recovered_1',
          telegram_payment_charge_id: 'charge_recovered_101',
          user_id: 1001,
          stars_amount: 75,
          attempts: 0,
          max_attempts: 5,
          correlation_id: 'corr_test_1',
        },
      ],
    } as any);

    const mockClient = {
      query: vi.fn()
        // 1. SELECT payment row for update (now reachable!)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pay_recovered_1',
              user_id: 1001,
              item_id: 'stardust_vault_2500',
              stars_amount: 75,
              status: 'created',
              telegram_payment_charge_id: null,
            },
          ],
        })
        // 2. Check global charge id uniqueness
        .mockResolvedValueOnce({ rows: [] })
        // 3. UPDATE payments set status = 'paid'
        .mockResolvedValueOnce({ rowCount: 1 })
        // 4. UPDATE wallets stardust
        .mockResolvedValueOnce({ rowCount: 1 }),
    };

    vi.mocked(db.transaction).mockImplementationOnce(async (callback: any) => {
      return await callback(mockClient);
    });

    // Mock reconciliation queue update to completed
    vi.mocked(db.query).mockResolvedValueOnce({ rowCount: 1 } as any);

    const reconRes = await reconcilePendingPayments();
    expect(reconRes.processed).toBe(1);
    expect(reconRes.succeeded).toBe(1);
    expect(reconRes.failed).toBe(0);

    // Verify reconciliation queue marked as 'completed'
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'completed'"),
      expect.arrayContaining([1, 'rec_uuid_1'])
    );
  });
});
