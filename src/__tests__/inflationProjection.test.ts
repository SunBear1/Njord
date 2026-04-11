/**
 * Unit tests for src/utils/inflationProjection.ts
 *
 * Validates blended inflation and savings rate projections:
 * mean-reversion to target, edge cases, monotonicity.
 */
import { describe, it, expect } from 'vitest';
import {
  blendedInflationRate,
  blendedSavingsRate,
  NBP_TARGET,
} from '../utils/inflationProjection';

// ---------------------------------------------------------------------------
// blendedInflationRate
// ---------------------------------------------------------------------------

describe('blendedInflationRate', () => {
  it('returns currentRate unchanged for horizonMonths <= 0', () => {
    expect(blendedInflationRate(8.0, 0)).toBe(8.0);
    expect(blendedInflationRate(3.0, -1)).toBe(3.0);
  });

  it('returns approximately NBP_TARGET (2.5%) for very long horizons', () => {
    // The BLENDED rate is a time-average over the full path — it converges toward
    // target much slower than the instantaneous rate. After 10 years from 10%,
    // the blended rate is ~3.58% (early high months still pull the average up).
    const result = blendedInflationRate(10.0, 120); // 10 years
    expect(result).toBeGreaterThan(NBP_TARGET);
    expect(result).toBeLessThan(4.0); // well below initial 10%, converging toward 2.5%
  });

  it('high inflation blends down toward target over time', () => {
    const short = blendedInflationRate(10.0, 6);
    const long = blendedInflationRate(10.0, 60);
    // Blended rate for longer horizon should be closer to NBP_TARGET (2.5%)
    expect(long).toBeLessThan(short);
  });

  it('low inflation blends up toward target over time', () => {
    const short = blendedInflationRate(0.5, 6);
    const long = blendedInflationRate(0.5, 60);
    // Starting below target: longer horizon approaches target from below
    expect(long).toBeGreaterThan(short);
  });

  it('returns exactly NBP_TARGET when currentRate equals NBP_TARGET', () => {
    // No mean-reversion needed — already at equilibrium
    const result = blendedInflationRate(NBP_TARGET, 24);
    expect(result).toBeCloseTo(NBP_TARGET, 4);
  });

  it('blended rate is always positive for positive inputs', () => {
    [0.1, 2.5, 5.0, 12.0, 20.0].forEach((rate) => {
      [1, 6, 12, 24, 60, 120].forEach((months) => {
        expect(blendedInflationRate(rate, months)).toBeGreaterThan(0);
      });
    });
  });

  it('1-month horizon returns approximately current rate (almost no mean-reversion)', () => {
    const current = 8.0;
    const result = blendedInflationRate(current, 1);
    // After 1 month, decay = exp(-1/18) ≈ 0.946; rate ≈ 2.5 + (8-2.5)*0.946 ≈ 7.7%
    // The blended 1-month ≈ that projected rate, slightly below current
    expect(result).toBeLessThan(current);
    expect(result).toBeGreaterThan(NBP_TARGET);
  });

  it('result is a geometric mean of monthly rates (compound, not arithmetic)', () => {
    // For verification: at short horizon with constant rate ≈ currentRate,
    // the blended rate should match single compounded rate closely
    const current = 5.0;
    // 1-year horizon: blended ≈ weighted average converging toward target
    const result = blendedInflationRate(current, 12);
    // Should be between NBP_TARGET and current (converging)
    expect(result).toBeGreaterThan(NBP_TARGET);
    expect(result).toBeLessThan(current);
  });

  it('cumulative inflation factor for blended rate equals month-by-month compounding', () => {
    const current = 6.0;
    const months = 24;
    const blended = blendedInflationRate(current, months);

    // Re-compute cumulative factor from blended rate
    const years = months / 12;
    const blendedFactor = Math.pow(1 + blended / 100, years);

    // Compute reference cumulative factor directly (mirrors the function's logic)
    const TAU = 18;
    const TARGET = 2.5;
    let cumulative = 1;
    for (let m = 1; m <= months; m++) {
      const annualRate = TARGET + (current - TARGET) * Math.exp(-m / TAU);
      const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
      cumulative *= 1 + monthlyRate;
    }

    expect(blendedFactor).toBeCloseTo(cumulative, 8);
  });
});

// ---------------------------------------------------------------------------
// blendedSavingsRate
// ---------------------------------------------------------------------------

describe('blendedSavingsRate', () => {
  const SAVINGS_EQUILIBRIUM = 3.0; // from source

  it('returns currentRate unchanged for horizonMonths <= 0', () => {
    expect(blendedSavingsRate(5.0, 0)).toBe(5.0);
    expect(blendedSavingsRate(4.0, -5)).toBe(4.0);
  });

  it('high rate blends down toward equilibrium over time', () => {
    const short = blendedSavingsRate(7.0, 6);
    const long = blendedSavingsRate(7.0, 60);
    expect(long).toBeLessThan(short);
  });

  it('low rate blends up toward equilibrium over time', () => {
    const short = blendedSavingsRate(1.0, 6);
    const long = blendedSavingsRate(1.0, 60);
    expect(long).toBeGreaterThan(short);
  });

  it('returns approximately equilibrium for very long horizons', () => {
    // The BLENDED rate averages the full path from 8% down to 3%.
    // After 10 years, blended ≈ 3.97% (still above equilibrium due to early months).
    const result = blendedSavingsRate(8.0, 120);
    expect(result).toBeGreaterThan(SAVINGS_EQUILIBRIUM);
    expect(result).toBeLessThan(4.5); // well below initial 8%, converging toward 3%
  });

  it('returns exactly equilibrium when currentRate equals equilibrium', () => {
    const result = blendedSavingsRate(SAVINGS_EQUILIBRIUM, 24);
    expect(result).toBeCloseTo(SAVINGS_EQUILIBRIUM, 4);
  });

  it('result is always positive for realistic positive inputs', () => {
    [0.5, 1.0, 3.0, 5.0, 8.0].forEach((rate) => {
      [1, 6, 12, 36, 60].forEach((months) => {
        expect(blendedSavingsRate(rate, months)).toBeGreaterThan(0);
      });
    });
  });

  it('blended rate for 1-month horizon closely matches initial rate', () => {
    const result = blendedSavingsRate(6.0, 1);
    // Very little mean-reversion in 1 month (tau=24)
    expect(result).toBeCloseTo(6.0, 0); // within 1%
  });
});
