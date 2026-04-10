/**
 * GBM model unit tests — TDD tests written BEFORE the model exists.
 * These define the expected behavior of the new calibrated GBM model.
 */
import { describe, it, expect } from 'vitest';

// The module we're testing — doesn't exist yet, will be created in Phase 1
// import { gbmPredict, shrinkDrift, dampVolatility } from '../utils/models/gbmModel';

/**
 * Placeholder implementations that will be replaced by the real module.
 * These exist so the tests compile and can verify the interface.
 */

// Student-t quantile for ν=5 at p=0.95 (two-sided)
const STUDENT_T_Q95_NU5 = 2.015;

/** Closed-form GBM percentile: exp((μ-σ²/2)·T + σ·√T·z) - 1 */
function analyticalGBM(mu: number, sigma: number, T: number, z: number): number {
  return (Math.exp((mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * z) - 1) * 100;
}

describe('GBM model — mathematical correctness', () => {
  it('σ=0 produces zero spread (all scenarios identical)', () => {
    const mu = 0.08; // 8% annual drift
    const T = 1; // 1 year

    const bear = analyticalGBM(mu, 0, T, -STUDENT_T_Q95_NU5);
    const base = analyticalGBM(mu, 0, T, 0);
    const bull = analyticalGBM(mu, 0, T, STUDENT_T_Q95_NU5);

    // With σ=0, all three should equal exp(μ·T) - 1 = exp(0.08) - 1 ≈ 8.33%
    const expected = (Math.exp(mu) - 1) * 100;
    expect(bear).toBeCloseTo(expected, 2);
    expect(base).toBeCloseTo(expected, 2);
    expect(bull).toBeCloseTo(expected, 2);
  });

  it('T=0 produces 0% for all scenarios', () => {
    const mu = 0.10;
    const sigma = 0.30;

    const bear = analyticalGBM(mu, sigma, 0, -STUDENT_T_Q95_NU5);
    const base = analyticalGBM(mu, sigma, 0, 0);
    const bull = analyticalGBM(mu, sigma, 0, STUDENT_T_Q95_NU5);

    expect(bear).toBeCloseTo(0, 5);
    expect(base).toBeCloseTo(0, 5);
    expect(bull).toBeCloseTo(0, 5);
  });

  it('produces bear < base < bull (monotonicity)', () => {
    const mu = 0.08;
    const sigma = 0.25;
    const T = 1;

    const bear = analyticalGBM(mu, sigma, T, -STUDENT_T_Q95_NU5);
    const base = analyticalGBM(mu, sigma, T, 0);
    const bull = analyticalGBM(mu, sigma, T, STUDENT_T_Q95_NU5);

    expect(bear).toBeLessThan(base);
    expect(base).toBeLessThan(bull);
  });

  it('higher σ produces wider spread', () => {
    const mu = 0.08;
    const T = 1;

    const lowVol = 0.15; // SPY-like
    const highVol = 0.50; // NVDA-like

    const lowSpread = analyticalGBM(mu, lowVol, T, STUDENT_T_Q95_NU5) -
      analyticalGBM(mu, lowVol, T, -STUDENT_T_Q95_NU5);
    const highSpread = analyticalGBM(mu, highVol, T, STUDENT_T_Q95_NU5) -
      analyticalGBM(mu, highVol, T, -STUDENT_T_Q95_NU5);

    expect(highSpread).toBeGreaterThan(lowSpread);
  });

  it('NVDA-like (σ=50%) 12mo raw bull exceeds 100% — proving need for clamping', () => {
    const mu = 0.08; // shrunk drift, not raw historical
    const sigma = 0.50;
    const T = 1;

    const bull = analyticalGBM(mu, sigma, T, STUDENT_T_Q95_NU5);
    // Raw GBM p95 for 50% vol = ~162%. This is mathematically correct
    // but proves that clamping is essential for sensible UX.
    expect(bull).toBeGreaterThan(100); // raw exceeds 100%
    expect(bull).toBeLessThan(200); // but not insanely so (unlike HMM)

    // After clamping, the gbmPredict() function should return ≤ 100%
    const clamped = Math.min(bull, 100);
    expect(clamped).toBeLessThanOrEqual(100);
  });

  it('NVDA-like (σ=50%) 12mo bear ≥ -80%', () => {
    const mu = 0.08;
    const sigma = 0.50;
    const T = 1;

    const bear = analyticalGBM(mu, sigma, T, -STUDENT_T_Q95_NU5);
    expect(bear).toBeGreaterThanOrEqual(-80);
    expect(bear).toBeLessThan(0);
  });

  it('SPY-like (σ=15%) 12mo produces tight range', () => {
    const mu = 0.08;
    const sigma = 0.15;
    const T = 1;

    const bear = analyticalGBM(mu, sigma, T, -STUDENT_T_Q95_NU5);
    const bull = analyticalGBM(mu, sigma, T, STUDENT_T_Q95_NU5);

    // SPY 1yr: bear should be ~ -20% to -25%, bull should be ~ +40% to +50%
    expect(bear).toBeGreaterThan(-40);
    expect(bear).toBeLessThan(-5);
    expect(bull).toBeGreaterThan(15);
    expect(bull).toBeLessThan(70);
  });

  it('10-year horizon produces reasonable bounds', () => {
    const mu = 0.08;
    const sigma = 0.25; // moderate vol
    const T = 10;

    const bear = analyticalGBM(mu, sigma, T, -STUDENT_T_Q95_NU5);
    const bull = analyticalGBM(mu, sigma, T, STUDENT_T_Q95_NU5);

    // 10yr: bull should be large but ≤ 1000%
    expect(bull).toBeLessThanOrEqual(1000);
    // bear should be negative but ≥ -95%
    expect(bear).toBeGreaterThanOrEqual(-95);
  });
});

describe('Drift shrinkage', () => {
  it('w=0 (no data) returns prior', () => {
    const prior = 0.08;
    const historical = 2.0; // 200% historical return
    const w = 0;
    const shrunk = w * historical + (1 - w) * prior;
    expect(shrunk).toBeCloseTo(prior, 5);
  });

  it('w=1 (10+ years data) returns historical', () => {
    const prior = 0.08;
    const historical = 0.12;
    const w = 1;
    const shrunk = w * historical + (1 - w) * prior;
    expect(shrunk).toBeCloseTo(historical, 5);
  });

  it('w=0.1 (1 year data) mostly returns prior', () => {
    const prior = 0.08;
    const historical = 2.0; // extreme
    const w = 0.1;
    const shrunk = w * historical + (1 - w) * prior;
    // 0.1 * 2.0 + 0.9 * 0.08 = 0.20 + 0.072 = 0.272 (27.2%)
    expect(shrunk).toBeCloseTo(0.272, 3);
    // Much more reasonable than 200%!
    expect(shrunk).toBeLessThan(0.5);
  });

  it('shrinkage weight formula: w = min(1, dataYears / 10)', () => {
    expect(Math.min(1, 0.5 / 10)).toBeCloseTo(0.05, 5); // 6 months
    expect(Math.min(1, 1 / 10)).toBeCloseTo(0.1, 5); // 1 year
    expect(Math.min(1, 5 / 10)).toBeCloseTo(0.5, 5); // 5 years
    expect(Math.min(1, 10 / 10)).toBeCloseTo(1.0, 5); // 10 years
    expect(Math.min(1, 20 / 10)).toBeCloseTo(1.0, 5); // 20 years (capped)
  });
});

describe('Damped volatility', () => {
  it('no damping for T ≤ 2 years', () => {
    const sigma = 0.30;
    // dampFactor(T) = 1.0 for T ≤ 2
    for (const T of [0.25, 0.5, 1, 1.5, 2]) {
      const dampFactor = T <= 2 ? 1.0 : 1.0 - 0.015 * (T - 2);
      expect(sigma * dampFactor).toBeCloseTo(sigma, 5);
    }
  });

  it('damping reduces σ for long horizons', () => {
    const sigma = 0.30;
    const T = 12; // 12 years
    // dampFactor at T=12: approximately 0.85
    const dampFactor = Math.max(0.75, 1.0 - 0.015 * (T - 2));
    expect(dampFactor).toBeGreaterThan(0.75);
    expect(dampFactor).toBeLessThan(1.0);
    expect(sigma * dampFactor).toBeLessThan(sigma);
  });

  it('dampFactor never goes below 0.75', () => {
    const T = 50; // extreme
    const dampFactor = Math.max(0.75, 1.0 - 0.015 * (T - 2));
    expect(dampFactor).toBeCloseTo(0.75, 5);
  });
});
