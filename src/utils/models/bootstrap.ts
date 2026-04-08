/**
 * Historical Block Bootstrap model.
 *
 * Non-parametric: resamples blocks of observed daily log-returns to build
 * forward-looking paths. Zero parameters → zero overfitting risk.
 * Automatically captures fat tails, skewness, and autocorrelation.
 */

import type { PredictionResult } from './types';
import { mulberry32, extractPercentiles } from './types';

const BLOCK_SIZE = 5; // trading days — preserves weekly autocorrelation
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
  const nBlocks = Math.ceil(horizonDays / BLOCK_SIZE);
  const maxStart = n - BLOCK_SIZE; // last valid block start index
  const finalReturns: number[] = [];

  for (let p = 0; p < N_PATHS; p++) {
    let cumLogReturn = 0;
    let daysAccumulated = 0;

    for (let b = 0; b < nBlocks && daysAccumulated < horizonDays; b++) {
      const start = Math.floor(rng() * (maxStart + 1));
      const blockEnd = Math.min(BLOCK_SIZE, horizonDays - daysAccumulated);

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
