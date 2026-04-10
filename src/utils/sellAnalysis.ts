/**
 * Optimal Sell Price Analysis — pure functions
 *
 * Uses HMM regime-conditioned Monte Carlo to simulate full price paths,
 * then computes touch probabilities, expected sell prices, and fan charts.
 */

import type { HmmModel } from './hmm';
import { mulberry32, boxMuller } from './hmm';
import type {
  FanChartPoint,
  DistributionStats,
  TouchResult,
  SellTarget,
} from '../types/sellAnalysis';

const N_PATHS = 10_000;

// ---------------------------------------------------------------------------
// Full-path Monte Carlo with regime switching
// ---------------------------------------------------------------------------

/**
 * Simulate `nPaths` GBM price paths with HMM regime transitions.
 * Returns a flat Float64Array per path: [price_day0, price_day1, ..., price_dayH].
 */
export function simulateFullPaths(
  model: HmmModel,
  currentState: number,
  currentPrice: number,
  horizonDays: number,
  nPaths: number = N_PATHS,
  seed: number = 42,
): Float64Array[] {
  const rng = mulberry32(seed);
  const paths: Float64Array[] = [];

  for (let p = 0; p < nPaths; p++) {
    const path = new Float64Array(horizonDays + 1);
    path[0] = currentPrice;
    let state = currentState;
    let price = currentPrice;

    for (let t = 0; t < horizonDays; t++) {
      const mu = model.means[state];
      const sigma = model.stds[state];

      const [z] = boxMuller(rng);
      const logReturn = (mu - 0.5 * sigma * sigma) + sigma * z;
      price *= Math.exp(logReturn);
      path[t + 1] = price;

      // Regime transition
      const u = rng();
      if (u > model.transmat[state][state]) {
        state = state === 0 ? 1 : 0;
      }
    }

    paths.push(path);
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Path analysis
// ---------------------------------------------------------------------------

interface PathStats {
  peakPrice: number;
  peakDay: number;
  finalPrice: number;
}

function analyzeOnePath(path: Float64Array): PathStats {
  let peakPrice = path[0];
  let peakDay = 0;
  for (let i = 1; i < path.length; i++) {
    if (path[i] > peakPrice) {
      peakPrice = path[i];
      peakDay = i;
    }
  }
  return { peakPrice, peakDay, finalPrice: path[path.length - 1] };
}

function percentiles(values: number[]): DistributionStats {
  if (values.length === 0) return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const p = (pct: number) => sorted[Math.min(Math.floor(pct * n), n - 1)];
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  return { p10: p(0.10), p25: p(0.25), p50: p(0.50), p75: p(0.75), p90: p(0.90), mean };
}

export function analyzePaths(paths: Float64Array[]) {
  const peaks: number[] = [];
  const peakDays: number[] = [];
  const finals: number[] = [];

  for (const path of paths) {
    const stats = analyzeOnePath(path);
    peaks.push(stats.peakPrice);
    peakDays.push(stats.peakDay);
    finals.push(stats.finalPrice);
  }

  return {
    peakDistribution: percentiles(peaks),
    peakTimingDistribution: percentiles(peakDays),
    finalPriceDistribution: percentiles(finals),
    medianFinalPrice: percentiles(finals).p50,
  };
}

// ---------------------------------------------------------------------------
// Touch probabilities
// ---------------------------------------------------------------------------

/**
 * Generate target price levels: from current price up to +40% in ~12 steps,
 * plus a few levels below current price.
 */
export function generateTargets(currentPrice: number): number[] {
  const targets: number[] = [];
  // -10% to +40% in 5% steps
  for (let pct = -10; pct <= 40; pct += 5) {
    targets.push(Math.round(currentPrice * (1 + pct / 100) * 100) / 100);
  }
  return targets;
}

export function computeTouchProbabilities(
  paths: Float64Array[],
  targets: number[],
): TouchResult[] {
  const nPaths = paths.length;

  return targets.map((target) => {
    let touches = 0;
    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        if (path[i] >= target) {
          touches++;
          break;
        }
      }
    }
    return { target, pTouch: touches / nPaths };
  });
}

// ---------------------------------------------------------------------------
// Expected sell price
// ---------------------------------------------------------------------------

export function computeExpectedSellPrices(
  touchResults: TouchResult[],
  medianFinalPrice: number,
  riskOfForcedSale: number,
): SellTarget[] {
  return touchResults.map(({ target, pTouch }) => ({
    target,
    pTouch,
    expectedValue: pTouch * target + (1 - pTouch) * medianFinalPrice,
    riskOfForcedSale,
  }));
}

export function findOptimalTarget(targets: SellTarget[]): SellTarget {
  if (targets.length === 0) return { target: 0, pTouch: 0, expectedValue: 0, riskOfForcedSale: 1 };
  let best = targets[0];
  for (const t of targets) {
    if (t.expectedValue > best.expectedValue) best = t;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Fan chart data
// ---------------------------------------------------------------------------

export function computeFanChart(
  paths: Float64Array[],
  horizonDays: number,
): FanChartPoint[] {
  const nPaths = paths.length;
  const points: FanChartPoint[] = [];
  const buffer: number[] = new Array(nPaths);

  for (let d = 0; d <= horizonDays; d++) {
    for (let p = 0; p < nPaths; p++) {
      buffer[p] = paths[p][d];
    }
    buffer.sort((a, b) => a - b);

    const pct = (q: number) => buffer[Math.floor(q * nPaths)] ?? buffer[nPaths - 1];
    points.push({
      day: d,
      p10: pct(0.10),
      p25: pct(0.25),
      p50: pct(0.50),
      p75: pct(0.75),
      p90: pct(0.90),
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Full analysis orchestrator
// ---------------------------------------------------------------------------

export function runSellAnalysis(
  model: HmmModel,
  currentState: number,
  currentPrice: number,
  horizonDays: number,
  seed: number = 42,
) {
  const paths = simulateFullPaths(model, currentState, currentPrice, horizonDays, N_PATHS, seed);

  const { peakDistribution, peakTimingDistribution, finalPriceDistribution, medianFinalPrice } =
    analyzePaths(paths);

  const targets = generateTargets(currentPrice);
  const touchProbabilities = computeTouchProbabilities(paths, targets);

  // Risk = P(final price < current price)
  let belowCount = 0;
  for (const path of paths) {
    if (path[path.length - 1] < currentPrice) belowCount++;
  }
  const riskOfForcedSale = belowCount / paths.length;

  const expectedSellPrices = computeExpectedSellPrices(touchProbabilities, medianFinalPrice, riskOfForcedSale);
  const optimalTarget = findOptimalTarget(expectedSellPrices);

  const fanChart = computeFanChart(paths, horizonDays);

  return {
    currentPrice,
    horizonDays,
    fanChart,
    peakDistribution,
    peakTimingDistribution,
    finalPriceDistribution,
    touchProbabilities,
    expectedSellPrices,
    optimalTarget,
    medianFinalPrice,
    riskOfForcedSale,
  };
}
