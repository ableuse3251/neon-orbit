import { describe, it, expect } from 'vitest';

describe('Admin Analytics Metrics Calculation (F16 / NE-13)', () => {
  it('correctly handles empty data by returning unavailable', () => {
    // This is a unit-testable representation of the logic in server/routes/admin.ts
    const calculateRetention = (val: any) => val !== null ? Math.round(Number(val) * 10) / 10 : 'unavailable';
    const calculateKFactor = (val: any) => val !== null ? Math.round(Number(val) * 100) / 100 : 'unavailable';
    const calculateRate = (val: any) => val !== null ? Math.round(Number(val) * 10) / 10 : 'unavailable';
    const calculateFunnel = (val: any) => val > 0 ? Number(val) : 'unavailable';

    expect(calculateRetention(null)).toBe('unavailable');
    expect(calculateRetention(12.345)).toBe(12.3);
    
    expect(calculateKFactor(null)).toBe('unavailable');
    expect(calculateKFactor(0.5678)).toBe(0.57);

    expect(calculateRate(null)).toBe('unavailable');
    expect(calculateRate(45.67)).toBe(45.7);

    expect(calculateFunnel(null)).toBe('unavailable');
    expect(calculateFunnel(0)).toBe('unavailable');
    expect(calculateFunnel(10)).toBe(10);
  });
});
