/**
 * Unit tests for src/utils/sellAnalysis.ts
 *
 * Tests the pure functions driving the Optimal Sell Price Analysis feature:
 * simulateFullPaths, computeTouchProbabilities, computeFanChart,
 * computeExpectedSellPrices, findOptimalTarget, generateTargets.
 */
import { describe, it, expect } from 'vitest';
import type { HmmModel } from '../utils/hmm';
import {
  simulateFullPaths,
  computeTouchProbabilities,
  computeFanChart,
  computeExpectedSellPrices,
  findOptimalTarget,
  generateTargets,
  analyzePaths,
} from '../utils/sellAnalysis';

// ---------------------------------------------------------------------------
// Deterministic minimal HMM (single state with zero variance)
// ---------------------------------------------------------------------------

/** A 2-state HMM where both states are identical and have zero volatility.
 *  Allows exact verification of paths without randomness. */
function zeroVolModel(mu = 0): HmmModel {
  return {
    nStates: 2,
    pi: [1, 0],
    transmat: [
      [1, 0],
      [0, 1],
    ],
    means: [mu, mu],
    stds: [1e-12, 1e-12], // effectively zero std
    logLikelihood: -1,
  };
}

/** A realistic 2-state model for sanity checks */
function realisticModel(): HmmModel {
  return {
    nStates: 2,
    pi: [0.5, 0.5],
    transmat: [
      [0.95, 0.05],
      [0.05, 0.95],
    ],
    means: [-0.001, 0.001],
    stds: [0.025, 0.015],
    logLikelihood: -500,
  };
}

// ---------------------------------------------------------------------------
// simulateFullPaths
// ---------------------------------------------------------------------------

describe('simulateFullPaths', () => {
  it('returns exactly nPaths paths', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 10, 50, 42);
    expect(paths).toHaveLength(50);
  });

  it('each path has horizonDays+1 price points', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 20, 10, 42);
    for (const path of paths) {
      expect(path.length).toBe(21); // 0..20
    }
  });

  it('all paths start at currentPrice', () => {
    const model = realisticModel();
    const currentPrice = 150.75;
    const paths = simulateFullPaths(model, 0, currentPrice, 10, 20, 42);
    for (const path of paths) {
      expect(path[0]).toBe(currentPrice);
    }
  });

  it('contains no NaN or Infinity values', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 30, 100, 99);
    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        expect(isFinite(path[i])).toBe(true);
        expect(isNaN(path[i])).toBe(false);
      }
    }
  });

  it('all prices are strictly positive', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 50, 30, 100, 7);
    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        expect(path[i]).toBeGreaterThan(0);
      }
    }
  });

  it('zero volatility model produces identical constant paths', () => {
    const model = zeroVolModel(0); // mu=0, σ≈0 → exp(0)=1 → price stays flat
    const paths = simulateFullPaths(model, 0, 100, 10, 5, 42);
    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        expect(path[i]).toBeCloseTo(100, 3);
      }
    }
  });

  it('positive drift model produces prices trending upward on average', () => {
    // mu=+0.002 per day (daily log-return) → price should trend up
    const model = zeroVolModel(0.002);
    // With zero vol, every path is exactly exp(mu*t) * startPrice
    const paths = simulateFullPaths(model, 0, 100, 30, 5, 42);
    const expectedFinal = 100 * Math.exp(0.002 * 30);
    for (const path of paths) {
      expect(path[30]).toBeCloseTo(expectedFinal, 1);
    }
  });

  it('deterministic with same seed, different with different seeds', () => {
    const model = realisticModel();
    const paths1a = simulateFullPaths(model, 0, 100, 10, 3, 42);
    const paths1b = simulateFullPaths(model, 0, 100, 10, 3, 42);
    const paths2 = simulateFullPaths(model, 0, 100, 10, 3, 99);

    expect(paths1a[0][5]).toBeCloseTo(paths1b[0][5], 10);
    expect(paths1a[0][5]).not.toBeCloseTo(paths2[0][5], 1);
  });
});

// ---------------------------------------------------------------------------
// computeTouchProbabilities
// ---------------------------------------------------------------------------

describe('computeTouchProbabilities', () => {
  it('returns one TouchResult per target', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 10, 50, 42);
    const targets = [90, 100, 110, 120];
    const results = computeTouchProbabilities(paths, targets);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.target)).toEqual(targets);
  });

  it('target below current price has pTouch ≈ 1 (always touched at day 0)', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 10, 100, 42);
    const results = computeTouchProbabilities(paths, [0.01]); // trivially low target
    expect(results[0].pTouch).toBe(1);
  });

  it('impossibly high target has pTouch = 0', () => {
    const model = zeroVolModel(0);
    const paths = simulateFullPaths(model, 0, 100, 10, 20, 42); // flat paths at ~100
    const results = computeTouchProbabilities(paths, [1_000_000]);
    expect(results[0].pTouch).toBe(0);
  });

  it('pTouch is monotonically non-increasing as target increases', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 30, 500, 42);
    const targets = [80, 90, 100, 110, 120, 140, 160];
    const results = computeTouchProbabilities(paths, targets);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].pTouch).toBeLessThanOrEqual(results[i - 1].pTouch);
    }
  });

  it('pTouch values are in [0, 1]', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 20, 100, 42);
    const targets = generateTargets(100);
    const results = computeTouchProbabilities(paths, targets);
    for (const r of results) {
      expect(r.pTouch).toBeGreaterThanOrEqual(0);
      expect(r.pTouch).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// computeFanChart
// ---------------------------------------------------------------------------

describe('computeFanChart', () => {
  it('returns horizonDays+1 points', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 20, 50, 42);
    const fan = computeFanChart(paths, 20);
    expect(fan).toHaveLength(21);
  });

  it('day 0 all percentiles equal currentPrice', () => {
    const model = realisticModel();
    const currentPrice = 123.45;
    const paths = simulateFullPaths(model, 0, currentPrice, 10, 100, 42);
    const fan = computeFanChart(paths, 10);
    const day0 = fan[0];
    expect(day0.p10).toBeCloseTo(currentPrice, 4);
    expect(day0.p25).toBeCloseTo(currentPrice, 4);
    expect(day0.p50).toBeCloseTo(currentPrice, 4);
    expect(day0.p75).toBeCloseTo(currentPrice, 4);
    expect(day0.p90).toBeCloseTo(currentPrice, 4);
  });

  it('percentiles are ordered: p10 <= p25 <= p50 <= p75 <= p90', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 30, 200, 42);
    const fan = computeFanChart(paths, 30);
    for (const point of fan) {
      expect(point.p10).toBeLessThanOrEqual(point.p25);
      expect(point.p25).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p75);
      expect(point.p75).toBeLessThanOrEqual(point.p90);
    }
  });

  it('fan widens over time (p90-p10 spread grows with days)', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 60, 500, 42);
    const fan = computeFanChart(paths, 60);
    const spread0 = fan[0].p90 - fan[0].p10;
    const spread30 = fan[30].p90 - fan[30].p10;
    const spread60 = fan[60].p90 - fan[60].p10;
    expect(spread30).toBeGreaterThan(spread0);
    expect(spread60).toBeGreaterThan(spread30);
  });

  it('all values are positive (prices cannot go negative)', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 30, 100, 42);
    const fan = computeFanChart(paths, 30);
    for (const point of fan) {
      expect(point.p10).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// computeExpectedSellPrices & findOptimalTarget
// ---------------------------------------------------------------------------

describe('computeExpectedSellPrices', () => {
  it('returns one SellTarget per TouchResult', () => {
    const touchResults = [
      { target: 100, pTouch: 0.9 },
      { target: 110, pTouch: 0.6 },
      { target: 120, pTouch: 0.3 },
    ];
    const results = computeExpectedSellPrices(touchResults, 95, 0.2);
    expect(results).toHaveLength(3);
  });

  it('expectedValue = pTouch × target + (1-pTouch) × medianFinalPrice', () => {
    const touchResults = [{ target: 110, pTouch: 0.7 }];
    const median = 95;
    const results = computeExpectedSellPrices(touchResults, median, 0.15);
    const expected = 0.7 * 110 + 0.3 * 95;
    expect(results[0].expectedValue).toBeCloseTo(expected, 6);
  });

  it('riskOfForcedSale is passed through unchanged', () => {
    const results = computeExpectedSellPrices([{ target: 100, pTouch: 0.5 }], 90, 0.333);
    expect(results[0].riskOfForcedSale).toBeCloseTo(0.333, 6);
  });
});

describe('findOptimalTarget', () => {
  it('returns target with highest expectedValue', () => {
    const targets = [
      { target: 100, pTouch: 1.0, expectedValue: 100, riskOfForcedSale: 0.1 },
      { target: 120, pTouch: 0.6, expectedValue: 115, riskOfForcedSale: 0.1 },
      { target: 140, pTouch: 0.3, expectedValue: 108, riskOfForcedSale: 0.1 },
    ];
    const optimal = findOptimalTarget(targets);
    expect(optimal.target).toBe(120);
    expect(optimal.expectedValue).toBe(115);
  });

  it('returns safe default when passed empty array', () => {
    const optimal = findOptimalTarget([]);
    expect(optimal.target).toBe(0);
    expect(optimal.expectedValue).toBe(0);
    expect(optimal.pTouch).toBe(0);
  });

  it('returns only element when array has one item', () => {
    const targets = [{ target: 105, pTouch: 0.8, expectedValue: 98, riskOfForcedSale: 0.2 }];
    const optimal = findOptimalTarget(targets);
    expect(optimal.target).toBe(105);
  });
});

// ---------------------------------------------------------------------------
// generateTargets
// ---------------------------------------------------------------------------

describe('generateTargets', () => {
  it('generates levels from -10% to +40% in 5% steps', () => {
    const targets = generateTargets(100);
    expect(targets[0]).toBeCloseTo(90, 2);   // -10%
    expect(targets[targets.length - 1]).toBeCloseTo(140, 2); // +40%
  });

  it('generates 11 targets for 100 price', () => {
    // -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40 → 11 steps
    const targets = generateTargets(100);
    expect(targets).toHaveLength(11);
  });

  it('scales proportionally with price', () => {
    const t200 = generateTargets(200);
    const t100 = generateTargets(100);
    expect(t200[0]).toBeCloseTo(t100[0] * 2, 2);
    expect(t200[t200.length - 1]).toBeCloseTo(t100[t100.length - 1] * 2, 2);
  });
});

// ---------------------------------------------------------------------------
// analyzePaths
// ---------------------------------------------------------------------------

describe('analyzePaths', () => {
  it('medianFinalPrice matches p50 of final price distribution', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 20, 200, 42);
    const result = analyzePaths(paths);
    expect(result.medianFinalPrice).toBeCloseTo(result.finalPriceDistribution.p50, 6);
  });

  it('peakDistribution.p50 >= finalPriceDistribution.p50', () => {
    // Mathematical guarantee: peak_i >= final_i for every single path by definition
    // (peak = max over all days >= last day value). By stochastic dominance this implies
    // every order statistic satisfies peak_(k) >= final_(k), including the median.
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 30, 300, 42);
    const result = analyzePaths(paths);
    expect(result.peakDistribution.p50).toBeGreaterThanOrEqual(result.finalPriceDistribution.p50);
  });

  it('all distribution stats are positive and finite', () => {
    const model = realisticModel();
    const paths = simulateFullPaths(model, 0, 100, 20, 100, 42);
    const result = analyzePaths(paths);
    const stats = [
      result.finalPriceDistribution,
      result.peakDistribution,
    ];
    for (const s of stats) {
      expect(isFinite(s.p10)).toBe(true);
      expect(s.p10).toBeGreaterThan(0);
      expect(s.p10).toBeLessThanOrEqual(s.p25);
      expect(s.p25).toBeLessThanOrEqual(s.p50);
      expect(s.p50).toBeLessThanOrEqual(s.p75);
      expect(s.p75).toBeLessThanOrEqual(s.p90);
    }
  });
});
