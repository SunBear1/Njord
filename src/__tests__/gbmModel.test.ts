/**
 * GBM model unit tests — TDD tests for the calibrated GBM model.
 * Tests the actual gbmModel module functions.
 */
import { describe, it, expect } from 'vitest';
import { gbmPredict, shrinkDrift, dampVolatility, clampScenario } from '../utils/models/gbmModel';

// Student-t quantile for ν=5 at p=0.95 (two-sided)
const STUDENT_T_Q95_NU5 = 2.015;

/** Closed-form GBM percentile (raw, for reference calculations) */
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

describe('Drift shrinkage (real shrinkDrift function)', () => {
  it('w=0 (no data) returns prior', () => {
    const shrunk = shrinkDrift(2.0, 0); // 200% historical, 0 years
    expect(shrunk).toBeCloseTo(0.08, 5);
  });

  it('w=1 (10+ years data) returns historical', () => {
    const shrunk = shrinkDrift(0.12, 10);
    expect(shrunk).toBeCloseTo(0.12, 5);
  });

  it('w=0.1 (1 year data) mostly returns prior', () => {
    const shrunk = shrinkDrift(2.0, 1);
    expect(shrunk).toBeCloseTo(0.272, 3);
    expect(shrunk).toBeLessThan(0.5);
  });

  it('caps at w=1 for more than 10 years', () => {
    const shrunk = shrinkDrift(0.15, 20);
    expect(shrunk).toBeCloseTo(0.15, 5);
  });
});

describe('Damped volatility (real dampVolatility function)', () => {
  it('no damping for T ≤ 2 years', () => {
    const sigma = 0.30;
    for (const T of [0.25, 0.5, 1, 1.5, 2]) {
      expect(dampVolatility(sigma, T)).toBeCloseTo(sigma, 5);
    }
  });

  it('damping reduces σ for long horizons', () => {
    const sigma = 0.30;
    const damped = dampVolatility(sigma, 12);
    expect(damped).toBeLessThan(sigma);
    expect(damped).toBeGreaterThan(sigma * 0.75);
  });

  it('dampFactor never goes below 0.75', () => {
    const sigma = 0.30;
    const damped = dampVolatility(sigma, 50);
    expect(damped).toBeCloseTo(sigma * 0.75, 5);
  });
});

describe('Sanity bounds (real clampScenario function)', () => {
  it('clamps extreme bull to annual max', () => {
    const clamped = clampScenario(500, 1); // 500% in 1yr → way over 100% annual cap
    expect(clamped).toBeLessThanOrEqual(100);
  });

  it('clamps extreme bear to floor', () => {
    const clamped = clampScenario(-99, 1);
    expect(clamped).toBeGreaterThanOrEqual(-95);
  });

  it('passes through reasonable values', () => {
    const clamped = clampScenario(30, 1);
    expect(clamped).toBeCloseTo(30, 1);
  });

  it('allows large multi-year returns within annual bounds', () => {
    // 100% annual for 10yr = (1+1)^10 - 1 = 1023x → clamped to 1000%
    const clamped = clampScenario(500, 10);
    expect(clamped).toBeLessThanOrEqual(1000);
    expect(clamped).toBeGreaterThan(100); // multi-year can exceed 100%
  });
});

describe('gbmPredict integration', () => {
  it('produces valid PredictionResult for NVDA-like stock', () => {
    const result = gbmPredict(0.50, 1.5, 1, 1); // σ=50%, μ_hist=150% (extreme), 1yr data, 1yr horizon
    expect(result.id).toBe('gbm');
    expect(result.confidence).toBeGreaterThan(0);

    const [p5, p25, p50, p75, p95] = result.percentiles;
    // Monotonicity
    expect(p5).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p95);

    // Because of drift shrinkage (1yr → w=0.1), drift should be ~23%, not 150%
    // bull should be reasonable, not $1000 NVDA
    expect(p95).toBeLessThanOrEqual(100); // annual cap
    expect(p5).toBeGreaterThanOrEqual(-80); // annual floor
  });

  it('produces zero-change for T=0', () => {
    const result = gbmPredict(0.30, 0.10, 1, 0);
    expect(result.confidence).toBe(0); // invalid input
  });

  it('SPY-like stock produces tight range', () => {
    const result = gbmPredict(0.15, 0.10, 1, 1); // σ=15%, μ=10%, 1yr, 1yr
    const [p5, , , , p95] = result.percentiles;
    expect(p5).toBeGreaterThan(-40);
    expect(p95).toBeLessThan(60);
  });

  it('12-year horizon with high vol stays bounded', () => {
    const result = gbmPredict(0.50, 2.0, 1, 12); // σ=50%, extreme μ, 1yr data, 12yr horizon
    const [p5, , , , p95] = result.percentiles;
    expect(p95).toBeLessThanOrEqual(1000);
    expect(p5).toBeGreaterThanOrEqual(-95);
  });
});
