/**
 * Historical Block Bootstrap model.
 *
 * Non-parametric: resamples blocks of observed daily log-returns to build
 * forward-looking paths. Zero parameters → zero overfitting risk.
 * Automatically captures fat tails, skewness, and autocorrelation.
 */

import type { PredictionResult } from './types';
import { mulberry32, extractPercentiles } from './types';

/**
 * Compute adaptive block size for the given horizon.
 *
 * Fixed blocks of 5 days capture weekly autocorrelation but miss
 * monthly momentum (20–60 day scale). Larger blocks for longer
 * horizons better capture persistence.
 *
 * Formula: min(20, max(5, floor(horizonDays / 20)))
 *   21 days  → block 5   (weekly autocorrelation)
 *   126 days → block 6   (slightly larger for 6-month horizon)
 *   252 days → block 12  (captures monthly momentum)
 *   400 days → block 20  (maximum)
 */
export function adaptiveBlockSize(horizonDays: number): number {
  return Math.min(20, Math.max(5, Math.floor(horizonDays / 20)));
}
const N_PATHS = 3000;

/**
 * Run block bootstrap Monte Carlo on daily log-returns.
 * @param logReturns Daily log-returns array (ln(P_t / P_{t-1}))
 * @param horizonDays Number of trading days to simulate forward
 * @param seed Deterministic PRNG seed
 */
export function bootstrapPredict(
  logReturns: number[],
  horizonDays: number,
  seed: number,
): PredictionResult {
  const n = logReturns.length;

  if (n < 20) {
    return {
      id: 'bootstrap',
      name: 'Bootstrap',
      description: 'Za mało danych historycznych (min. 20 obserwacji).',
      percentiles: [0, 0, 0, 0, 0],
      confidence: 0,
    };
  }

  const rng = mulberry32(seed);
  const blockSize = adaptiveBlockSize(horizonDays);
  const nBlocks = Math.ceil(horizonDays / blockSize);
  const maxStart = n - blockSize; // last valid block start index

  if (maxStart < 0) {
    return {
      id: 'bootstrap',
      name: 'Bootstrap',
      description: 'Za mało danych historycznych dla wybranego rozmiaru bloku.',
      percentiles: [0, 0, 0, 0, 0],
      confidence: 0,
    };
  }

  const finalReturns: number[] = [];

  for (let p = 0; p < N_PATHS; p++) {
    let cumLogReturn = 0;
    let daysAccumulated = 0;

    for (let b = 0; b < nBlocks && daysAccumulated < horizonDays; b++) {
      const start = Math.floor(rng() * (maxStart + 1));
      const blockEnd = Math.min(blockSize, horizonDays - daysAccumulated);

      for (let d = 0; d < blockEnd; d++) {
        cumLogReturn += logReturns[start + d];
      }
      daysAccumulated += blockEnd;
    }

    finalReturns.push((Math.exp(cumLogReturn) - 1) * 100);
  }

  finalReturns.sort((a, b) => a - b);

  // Confidence: scales with data length (100 obs → 0.5, 500+ → ~0.85)
  const confidence = Math.min(0.95, 0.3 + 0.55 * (1 - Math.exp(-n / 300)));

  return {
    id: 'bootstrap',
    name: 'Bootstrap',
    description: 'Resampling historycznych zwrotów — brak założeń o rozkładzie, uczciwe przedziały.',
    percentiles: extractPercentiles(finalReturns),
    confidence,
  };
}
