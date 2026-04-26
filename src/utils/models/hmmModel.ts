/**
 * HMM prediction model adapter.
 *
 * Wraps the existing 2-state Gaussian HMM (Baum-Welch EM + Monte Carlo)
 * to produce a PredictionResult compatible with the multi-model framework.
 *
 * Improvements over direct hmm.ts usage:
 * - Minimum 250 observations (was 20)
 * - Kurtosis warning in description
 * - Confidence incorporates posterior probability and data adequacy
 */

import type { PredictionResult } from './types';
import {
  fitGaussianHmm,
  detectCurrentRegime,
  regimeConditionedMonteCarlo,
  type RegimeInfo,
} from '../hmm';

const MIN_OBSERVATIONS = 250;
const N_PATHS = 3000;
const TRADING_DAYS_YEAR = 252;

function kurtosis(data: number[]): number {
  const n = data.length;
  const m = data.reduce((a, b) => a + b, 0) / n;
  const m2 = data.reduce((a, r) => a + (r - m) ** 2, 0) / n;
  const m4 = data.reduce((a, r) => a + (r - m) ** 4, 0) / n;
  return m2 > 0 ? m4 / (m2 * m2) : 3;
}

/**
 * Run HMM regime detection + Monte Carlo prediction.
 * @param logReturns Daily log-returns
 * @param horizonDays Forward simulation horizon
 * @param seed PRNG seed
 * @returns PredictionResult + optional regime info
 */
export function hmmPredict(
  logReturns: number[],
  horizonDays: number,
  seed: number,
): { prediction: PredictionResult; regime: RegimeInfo | null } {
  const n = logReturns.length;

  if (n < MIN_OBSERVATIONS) {
    return {
      prediction: {
        id: 'hmm',
        name: 'HMM',
        description: `Za mało danych (${n}/${MIN_OBSERVATIONS} obserwacji). HMM wymaga min. ${MIN_OBSERVATIONS} dni.`,
        percentiles: [0, 0, 0, 0, 0],
        confidence: 0,
      },
      regime: null,
    };
  }

  const model = fitGaussianHmm(logReturns, 2, seed);

  if (!model) {
    return {
      prediction: {
        id: 'hmm',
        name: 'HMM',
        description: 'Model HMM nie zbiegł. Dane mogą być zbyt jednorodne dla detekcji reżimów.',
        percentiles: [0, 0, 0, 0, 0],
        confidence: 0,
      },
      regime: null,
    };
  }

  const regime = detectCurrentRegime(logReturns, model);
  const mc = regimeConditionedMonteCarlo(model, regime.currentState, horizonDays, N_PATHS, seed + 1);

  const kurt = kurtosis(logReturns);
  const fatTailWarning = kurt > 5
    ? ` ⚠ Grube ogony (kurtoza=${kurt.toFixed(1)}) — Gaussian HMM może zaniżać ryzyko ekstremalne.`
    : '';

  const bearAnnual = (Math.exp(model.means[0] * TRADING_DAYS_YEAR) - 1) * 100;
  const bullAnnual = (Math.exp(model.means[1] * TRADING_DAYS_YEAR) - 1) * 100;
  const regimeLabel = regime.currentRegimeLabel === 'bull' ? 'wzrost' : 'spadek';

  // Confidence: posterior probability × data adequacy × model fit
  const posteriorFactor = regime.posteriorProbability;
  const dataFactor = Math.min(1, n / 500); // 500 obs → full credit
  // Confidence capped at 0.25: HMM is informational only, must never be the recommended model
  const confidence = Math.min(0.25, posteriorFactor * 0.5 + dataFactor * 0.3 + 0.1);

  return {
    prediction: {
      id: 'hmm',
      name: 'HMM',
      description: `Reżim: ${regimeLabel} (${Math.round(regime.posteriorProbability * 100)}%). Bear: ${bearAnnual.toFixed(0)}%/rok, Bull: ${bullAnnual.toFixed(0)}%/rok.${fatTailWarning}`,
      percentiles: mc.percentiles,
      confidence,
    },
    regime,
  };
}
