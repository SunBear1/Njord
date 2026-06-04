import { describe, test, expect } from 'vitest';
import {
  validateAllocations,
  normalizeAllocations,
  adjustAllocation,
} from '../utils/allocationValidation';

describe('validateAllocations', () => {
  test('exact 100% is valid', () => {
    const result = validateAllocations([
      { allocationPercent: 60 },
      { allocationPercent: 40 },
    ]);
    expect(result.valid).toBe(true);
    expect(result.sum).toBe(100);
    expect(result.delta).toBe(0);
  });

  test('within tolerance is valid', () => {
    const result = validateAllocations([
      { allocationPercent: 33.33 },
      { allocationPercent: 33.33 },
      { allocationPercent: 33.34 },
    ]);
    expect(result.valid).toBe(true);
  });

  test('over 100% is invalid', () => {
    const result = validateAllocations([
      { allocationPercent: 60 },
      { allocationPercent: 50 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.delta).toBeGreaterThan(0);
  });

  test('under 100% is invalid', () => {
    const result = validateAllocations([
      { allocationPercent: 30 },
      { allocationPercent: 30 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.delta).toBeLessThan(0);
  });

  test('empty array sums to 0', () => {
    const result = validateAllocations([]);
    expect(result.valid).toBe(false);
    expect(result.sum).toBe(0);
  });

  test('single item at 100% is valid', () => {
    const result = validateAllocations([{ allocationPercent: 100 }]);
    expect(result.valid).toBe(true);
  });

  test('custom tolerance works', () => {
    const result = validateAllocations(
      [{ allocationPercent: 99 }, { allocationPercent: 0.5 }],
      0.5,
    );
    expect(result.valid).toBe(true); // 99.5, within 0.5 tolerance
  });
});

describe('normalizeAllocations', () => {
  test('already at 100% returns same values', () => {
    const result = normalizeAllocations([
      { allocationPercent: 60 },
      { allocationPercent: 40 },
    ]);
    expect(result[0].allocationPercent).toBeCloseTo(60);
    expect(result[1].allocationPercent).toBeCloseTo(40);
  });

  test('scales up proportionally', () => {
    const result = normalizeAllocations([
      { allocationPercent: 30 },
      { allocationPercent: 20 },
    ]);
    expect(result[0].allocationPercent).toBeCloseTo(60);
    expect(result[1].allocationPercent).toBeCloseTo(40);
  });

  test('scales down proportionally', () => {
    const result = normalizeAllocations([
      { allocationPercent: 60 },
      { allocationPercent: 60 },
    ]);
    expect(result[0].allocationPercent).toBeCloseTo(50);
    expect(result[1].allocationPercent).toBeCloseTo(50);
  });

  test('all zeros distributes equally', () => {
    const result = normalizeAllocations([
      { allocationPercent: 0 },
      { allocationPercent: 0 },
      { allocationPercent: 0 },
    ]);
    expect(result[0].allocationPercent).toBeCloseTo(33.33, 0);
    expect(result[1].allocationPercent).toBeCloseTo(33.33, 0);
    expect(result[2].allocationPercent).toBeCloseTo(33.33, 0);
  });

  test('empty array returns empty', () => {
    const result = normalizeAllocations([]);
    expect(result).toEqual([]);
  });

  test('preserves extra properties', () => {
    const result = normalizeAllocations([
      { allocationPercent: 50, instrumentId: 'etf1', instrumentType: 'etf' as const, expectedReturnPercent: 9 },
      { allocationPercent: 50, instrumentId: 'etf2', instrumentType: 'etf' as const, expectedReturnPercent: 8 },
    ]);
    expect(result[0]).toHaveProperty('instrumentId', 'etf1');
  });
});

describe('adjustAllocation', () => {
  test('adjusting one redistributes others proportionally', () => {
    const result = adjustAllocation(
      [
        { allocationPercent: 50 },
        { allocationPercent: 30 },
        { allocationPercent: 20 },
      ],
      0,
      70, // increase first from 50 to 70
    );
    expect(result[0].allocationPercent).toBe(70);
    expect(
      result[1].allocationPercent + result[2].allocationPercent,
    ).toBeCloseTo(30);
    // Proportional: 30/(30+20) * 30 = 18, 20/(30+20) * 30 = 12
    expect(result[1].allocationPercent).toBeCloseTo(18, 0);
    expect(result[2].allocationPercent).toBeCloseTo(12, 0);
  });

  test('setting to 100% zeros others', () => {
    const result = adjustAllocation(
      [
        { allocationPercent: 50 },
        { allocationPercent: 30 },
        { allocationPercent: 20 },
      ],
      0,
      100,
    );
    expect(result[0].allocationPercent).toBe(100);
    expect(result[1].allocationPercent).toBe(0);
    expect(result[2].allocationPercent).toBe(0);
  });

  test('setting to 0% redistributes to others', () => {
    const result = adjustAllocation(
      [
        { allocationPercent: 50 },
        { allocationPercent: 30 },
        { allocationPercent: 20 },
      ],
      0,
      0,
    );
    expect(result[0].allocationPercent).toBe(0);
    expect(
      result[1].allocationPercent + result[2].allocationPercent,
    ).toBeCloseTo(100);
  });

  test('clamps negative to 0', () => {
    const result = adjustAllocation(
      [{ allocationPercent: 50 }, { allocationPercent: 50 }],
      0,
      -10,
    );
    expect(result[0].allocationPercent).toBe(0);
    expect(result[1].allocationPercent).toBe(100);
  });

  test('clamps above 100 to 100', () => {
    const result = adjustAllocation(
      [{ allocationPercent: 50 }, { allocationPercent: 50 }],
      0,
      150,
    );
    expect(result[0].allocationPercent).toBe(100);
    expect(result[1].allocationPercent).toBe(0);
  });

  test('single allocation always returns 100%', () => {
    const result = adjustAllocation([{ allocationPercent: 50 }], 0, 30);
    expect(result[0].allocationPercent).toBe(100);
  });

  test('others all zero distributes remaining equally', () => {
    const result = adjustAllocation(
      [
        { allocationPercent: 100 },
        { allocationPercent: 0 },
        { allocationPercent: 0 },
      ],
      0,
      40, // Reduce first to 40, 60 remaining split equally
    );
    expect(result[0].allocationPercent).toBe(40);
    expect(result[1].allocationPercent).toBe(30);
    expect(result[2].allocationPercent).toBe(30);
  });
});
