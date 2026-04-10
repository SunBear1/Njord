/**
 * Model selector — scores prediction models via out-of-sample backtest.
 *
 * Methodology:
 * 1. Split data: training = all except last TEST_DAYS, test = last TEST_DAYS
 * 2. Each model trains on training data, predicts TEST_DAYS forward
 * 3. Count how many test-period cumulative returns fall in [p5, p95]
 * 4. Coverage = count / TEST_DAYS — ideal is 0.90
 * 5. Best model: closest to 0.90 coverage
 */

import type { PredictionResult, ModelScoringResult, Percentiles } from './types';
import { bootstrapPredict } from './bootstrap';
import { garchPredict } from './garch';
import { hmmPredict } from './hmmModel';

const TEST_DAYS = 63; // ~1 quarter of trading days
const MIN_TRAIN_DAYS = 60; // minimum training data for backtest

type ModelFactory = (logReturns: number[], horizonDays: number, seed: number) => PredictionResult;

/** Compute realized cumulative returns over rolling windows in the test period.
 *  Only includes windows with at least half the target horizon to avoid
 *  truncated windows inflating coverage scores. */
function realizedReturns(logReturns: number[], testStart: number, horizonDays: number): number[] {
  const returns: number[] = [];
  const minDays = Math.max(1, Math.floor(horizonDays * 0.5));

  for (let t = testStart; t < logReturns.length; t++) {
    const remaining = Math.min(horizonDays, logReturns.length - t);
    if (remaining < minDays) break; // stop before severely truncated windows
    let cum = 0;
    for (let d = 0; d < remaining; d++) {
      cum += logReturns[t + d];
    }
    returns.push((Math.exp(cum) - 1) * 100);
  }
  return returns;
}

/** Coverage: fraction of realized returns within [p5, p95] */
function computeCoverage(realized: number[], percentiles: Percentiles): number {
  if (realized.length === 0) return 0;
  const [p5, , , , p95] = percentiles;
  let inRange = 0;
  for (const r of realized) {
    if (r >= p5 && r <= p95) inRange++;
  }
  return inRange / realized.length;
}

/** Wrap model factories to extract just PredictionResult */
function wrapHmm(logReturns: number[], horizonDays: number, seed: number): PredictionResult {
  return hmmPredict(logReturns, horizonDays, seed).prediction;
}

const MODEL_FACTORIES: ModelFactory[] = [
  bootstrapPredict,
  garchPredict,
  wrapHmm,
];

/**
 * Score all models and pick the recommended one.
 * @param logReturns Full daily log-returns array
 * @param horizonDays Prediction horizon in trading days
 * @param seed PRNG seed
 * @param fullPredictions Pre-computed predictions on full data (to avoid re-running models)
 */
export function selectBestModel(
  logReturns: number[],
  horizonDays: number,
  seed: number,
  fullPredictions: PredictionResult[],
): ModelScoringResult {
  const n = logReturns.length;

  // If not enough data for backtesting, just rank by confidence
  if (n < MIN_TRAIN_DAYS + TEST_DAYS) {
    const scored = fullPredictions.map(p => ({ ...p, coverageScore: undefined }));
    const bestIdx = scored.reduce((bi, p, i) => p.confidence > scored[bi].confidence ? i : bi, 0);
    return {
      scored,
      recommendedIndex: bestIdx,
      bestCoverage: 0,
    };
  }

  // Split: train on first (n - TEST_DAYS), test on last TEST_DAYS
  const trainEnd = n - TEST_DAYS;
  const trainData = logReturns.slice(0, trainEnd);

  // Each model predicts on training data with same horizon
  const backHorizon = Math.min(horizonDays, TEST_DAYS);
  const backtestPredictions: PredictionResult[] = MODEL_FACTORIES.map(
    (factory, i) => {
      // Skip models that had 0 confidence on full data (they'd fail on subset too)
      if (fullPredictions[i].confidence === 0) {
        return fullPredictions[i];
      }
      return factory(trainData, backHorizon, seed + 100 + i);
    },
  );

  // Compute realized cumulative returns over rolling windows starting from test period
  const realized = realizedReturns(logReturns, trainEnd, backHorizon);

  // Score each model
  const scored = fullPredictions.map((pred, i) => {
    const bt = backtestPredictions[i];
    const coverage = bt.confidence > 0 ? computeCoverage(realized, bt.percentiles) : 0;
    return { ...pred, coverageScore: coverage };
  });

  // Pick: closest to 90% coverage, prefer higher confidence as tiebreaker
  let bestIdx = 0;
  let bestScore = Infinity;

  for (let i = 0; i < scored.length; i++) {
    const cov = scored[i].coverageScore ?? 0;
    if (scored[i].confidence === 0) continue; // skip broken models

    const distance = Math.abs(cov - 0.90);
    const tiebreak = 1 - scored[i].confidence * 0.01; // tiny preference for higher confidence
    const score = distance + tiebreak;

    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return {
    scored,
    recommendedIndex: bestIdx,
    bestCoverage: scored[bestIdx].coverageScore ?? 0,
  };
}
