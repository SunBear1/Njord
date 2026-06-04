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
      // mu is the mean of observed daily log-returns as fitted by Baum-Welch.
      // Because log-returns already embed the Itô correction (E[log(S_t/S_{t-1})] = μ_simple - σ²/2),
      // no additional -0.5·σ² term is needed here. Adding it would double-correct and bias paths down.
      const logReturn = mu + sigma * z;
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
 * Generate target price levels around the current price.
 *
 * Downside range: -25% to -5% (3% steps + existing -10%, -5%)
 * Flat:           0% (current price itself)
 * Upside range:   +5% to +40% in 5% steps
 *
 * The current price (0%) is included as a natural boundary.
 * Downside targets use `P(min_path ≤ target)` (drawdown risk).
 * Upside targets use `P(max_path ≥ target)` (touch probability).
 */
export function generateTargets(currentPrice: number): number[] {
  const targets: number[] = [];
  // -25% to +40% in 5% steps
  for (let pct = -25; pct <= 40; pct += 5) {
    targets.push(Math.round(currentPrice * (1 + pct / 100) * 100) / 100);
  }
  return targets;
}

export function computeTouchProbabilities(
  paths: Float64Array[],
  targets: number[],
  currentPrice: number,
): TouchResult[] {
  const nPaths = paths.length;

  return targets.map((target) => {
    const isDownside = target < currentPrice;
    let touches = 0;
    const touchDays: number[] = [];

    for (const path of paths) {
      for (let i = 0; i < path.length; i++) {
        const touched = isDownside ? path[i] <= target : path[i] >= target;
        if (touched) {
          touches++;
          touchDays.push(i);
          break;
        }
      }
    }

    const pTouch = touches / nPaths;
    const meanTouchDay = touchDays.length > 0
      ? touchDays.reduce((a, b) => a + b, 0) / touchDays.length
      : 0;

    return {
      target,
      pTouch,
      type: isDownside ? 'downside' : 'upside',
      meanTouchDay,
    };
  });
}

// ---------------------------------------------------------------------------
// Expected sell price
// ---------------------------------------------------------------------------

/**
 * Annual risk-free rate for reinvestment gain calculation (time-weighted EV).
 * Represents the opportunity cost of capital for Polish investors (~4% NBP rate).
 * Set to 0 to collapse the formula to the unweighted original.
 */
const RISK_FREE_RATE = 0.04;

/**
 * Compute expected sell prices with time-weighted expected value.
 *
 * When a target is touched early, the remaining holding period can be
 * reinvested at the risk-free rate. Early-touching targets are therefore
 * worth more than late-touching targets with the same pTouch.
 *
 * Formula:
 *   EV = pTouch × target × (1 + rf × remainingDays/252)
 *      + (1 - pTouch) × medianFinalPrice
 *
 * where remainingDays = horizonDays - meanTouchDay.
 *
 * With RISK_FREE_RATE = 0 this collapses to the original unweighted formula.
 */
export function computeExpectedSellPrices(
  touchResults: TouchResult[],
  medianFinalPrice: number,
  riskOfForcedSale: number,
  horizonDays: number,
): SellTarget[] {
  return touchResults.map(({ target, pTouch, type, meanTouchDay }) => {
    const remainingDays = horizonDays - meanTouchDay;
    const reinvestmentGain = 1 + RISK_FREE_RATE * (remainingDays / 252);
    const expectedValue = pTouch * target * reinvestmentGain
      + (1 - pTouch) * medianFinalPrice;
    return {
      target,
      pTouch,
      expectedValue,
      riskOfForcedSale,
      meanTouchDay,
      type,
    };
  });
}

export function findOptimalTarget(targets: SellTarget[]): SellTarget {
  if (targets.length === 0) {
    return { target: 0, pTouch: 0, expectedValue: 0, riskOfForcedSale: 1, meanTouchDay: 0, type: 'upside' };
  }
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
  const touchProbabilities = computeTouchProbabilities(paths, targets, currentPrice);

  // Risk = P(final price < current price)
  let belowCount = 0;
  for (const path of paths) {
    if (path[path.length - 1] < currentPrice) belowCount++;
  }
  const riskOfForcedSale = belowCount / paths.length;

  const expectedSellPrices = computeExpectedSellPrices(touchProbabilities, medianFinalPrice, riskOfForcedSale, horizonDays);
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
