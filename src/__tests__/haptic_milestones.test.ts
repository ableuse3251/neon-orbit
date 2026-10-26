import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerHaptic } from '../utils/telegram';

describe('Combo Milestones & triggerHaptic impact tests', () => {
  let mockImpactOccurred: ReturnType<typeof vi.fn>;
  let mockNotificationOccurred: ReturnType<typeof vi.fn>;
  let mockSelectionChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockImpactOccurred = vi.fn();
    mockNotificationOccurred = vi.fn();
    mockSelectionChanged = vi.fn();

    // Mock window and Telegram WebApp HapticFeedback in Node environment
    (globalThis as any).window = {
      Telegram: {
        WebApp: {
          HapticFeedback: {
            impactOccurred: mockImpactOccurred,
            notificationOccurred: mockNotificationOccurred,
            selectionChanged: mockSelectionChanged,
          },
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    vi.restoreAllMocks();
  });

  it('triggers impactOccurred with heavy style by default when triggerHaptic("impact") is invoked', () => {
    triggerHaptic('impact');
    expect(mockImpactOccurred).toHaveBeenCalledWith('heavy');
    expect(mockImpactOccurred).toHaveBeenCalledTimes(1);
  });

  it('triggers impactOccurred with custom style when provided to triggerHaptic("impact", style)', () => {
    triggerHaptic('impact', 'medium');
    expect(mockImpactOccurred).toHaveBeenCalledWith('medium');

    triggerHaptic('impact', 'light');
    expect(mockImpactOccurred).toHaveBeenCalledWith('light');

    triggerHaptic('impact', 'rigid');
    expect(mockImpactOccurred).toHaveBeenCalledWith('rigid');

    triggerHaptic('impact', 'soft');
    expect(mockImpactOccurred).toHaveBeenCalledWith('soft');
  });

  it('triggers notificationOccurred for notification types and selectionChanged for selection', () => {
    triggerHaptic('success');
    expect(mockNotificationOccurred).toHaveBeenCalledWith('success');

    triggerHaptic('error');
    expect(mockNotificationOccurred).toHaveBeenCalledWith('error');

    triggerHaptic('warning');
    expect(mockNotificationOccurred).toHaveBeenCalledWith('warning');

    triggerHaptic('selection');
    expect(mockSelectionChanged).toHaveBeenCalledTimes(1);
  });

  it('verifies combo milestone detection logic for every 10 hits', () => {
    const isMilestone = (combo: number) => combo > 0 && combo % 10 === 0;

    // Non-milestones
    expect(isMilestone(0)).toBe(false);
    expect(isMilestone(1)).toBe(false);
    expect(isMilestone(5)).toBe(false);
    expect(isMilestone(9)).toBe(false);
    expect(isMilestone(11)).toBe(false);
    expect(isMilestone(19)).toBe(false);
    expect(isMilestone(25)).toBe(false);

    // Milestones (every 10 hits)
    expect(isMilestone(10)).toBe(true);
    expect(isMilestone(20)).toBe(true);
    expect(isMilestone(30)).toBe(true);
    expect(isMilestone(50)).toBe(true);
    expect(isMilestone(100)).toBe(true);
  });

  it('simulates hits stream and ensures triggerHaptic("impact") is called on milestones', () => {
    let combo = 0;
    const hapticCalls: string[] = [];

    const onHit = () => {
      combo++;
      if (combo > 0 && combo % 10 === 0) {
        triggerHaptic('impact');
        hapticCalls.push(`milestone_${combo}`);
      } else {
        triggerHaptic('light');
        hapticCalls.push(`normal_${combo}`);
      }
    };

    // Simulate 25 hits
    for (let i = 0; i < 25; i++) {
      onHit();
    }

    // Milestones at 10 and 20 are heavy impact, others are light impact
    expect(mockImpactOccurred).toHaveBeenCalledTimes(25);
    expect(mockImpactOccurred).toHaveBeenNthCalledWith(10, 'heavy');
    expect(mockImpactOccurred).toHaveBeenNthCalledWith(20, 'heavy');
    expect(mockImpactOccurred).toHaveBeenNthCalledWith(1, 'light');
    expect(mockImpactOccurred).toHaveBeenNthCalledWith(9, 'light');
    expect(mockImpactOccurred).toHaveBeenNthCalledWith(11, 'light');
    expect(hapticCalls[9]).toBe('milestone_10');
    expect(hapticCalls[19]).toBe('milestone_20');
    expect(hapticCalls[0]).toBe('normal_1');
    expect(hapticCalls[8]).toBe('normal_9');
    expect(hapticCalls[10]).toBe('normal_11');
  });
});
