/**
 * Web Worker for heavy volatility model computation (HMM + Bootstrap + GBM).
 *
 * Runs all three prediction models off the main thread to prevent UI freezes.
 * HMM Baum-Welch + 3000-path Monte Carlo and Bootstrap 3000-path simulation
 * are the expensive operations that previously blocked the main thread for ~200ms+.
 *
 * Message protocol:
 *   → { type: 'run', payload: VolatilityWorkerRequest }
 *   ← { type: 'result', payload: VolatilityWorkerResult }
 *   ← { type: 'error', message: string }
 */

import { bootstrapPredict } from '../utils/models/bootstrap';
import { gbmPredict } from '../utils/models/gbmModel';
import { hmmPredict } from '../utils/models/hmmModel';
import { getRegimeAdjustedPrior } from '../utils/models/regimePrior';
import { TRADING_DAYS_PER_YEAR } from '../utils/assetConfig';
import type { PredictionResult, ModelResults } from '../utils/models/types';
import type { RegimeInfo } from '../utils/hmm';

export interface VolatilityWorkerRequest {
  stockLogRet: number[];
  stockSigmaAnnual: number;
  stockMeanAnnual: number;
  seed: number;
  debouncedHorizon: number;
}

export interface VolatilityWorkerResult {
  modelResults: ModelResults;
  regime: RegimeInfo | null;
  /** Per-model scenario percentiles + metadata for toScenarios conversion on main thread */
  predictions: {
    id: string;
    percentiles: [number, number, number, number, number];
    confidence: number;
  }[];
  recommendedIndex: number;
}

/** Threshold: horizons ≤ this use bootstrap as primary, longer use GBM */
const BOOTSTRAP_HORIZON_MONTHS = 6;

self.onmessage = (event: MessageEvent<{ type: string; payload: VolatilityWorkerRequest }>) => {
  const { type, payload } = event.data;
  if (type !== 'run') return;

  try {
    const {
      stockLogRet, stockSigmaAnnual, stockMeanAnnual,
      seed, debouncedHorizon,
    } = payload;

    const T = debouncedHorizon / 12;
    const dataYears = stockLogRet.length / TRADING_DAYS_PER_YEAR;

    const bootstrapHorizonDays = Math.min(Math.round(debouncedHorizon * 21), 504);

    // HMM — regime detection (informational)
    const hmmResult = hmmPredict(stockLogRet, bootstrapHorizonDays, seed);

    // Regime-adjusted drift prior for GBM
    const hmmPosteriorBull = hmmResult.regime?.currentRegimeLabel === 'bull'
      ? hmmResult.regime.posteriorProbability
      : hmmResult.regime
        ? 1 - hmmResult.regime.posteriorProbability
        : null;
    const regimePrior = getRegimeAdjustedPrior(hmmPosteriorBull);

    // GBM (closed-form)
    const gbmResult = gbmPredict(
      stockSigmaAnnual / 100,
      stockMeanAnnual / 100,
      dataYears,
      T,
      regimePrior,
    );

    // Bootstrap (Monte Carlo)
    const bootstrapResult = bootstrapPredict(stockLogRet, bootstrapHorizonDays, seed);

    // Tiered selection
    const allPredictions: PredictionResult[] = [gbmResult, bootstrapResult];
    const useBootstrapPrimary = debouncedHorizon <= BOOTSTRAP_HORIZON_MONTHS;
    const recommendedIndex = useBootstrapPrimary ? 1 : 0;
    const recommended = allPredictions[recommendedIndex];

    const scoring = {
      scored: allPredictions,
      recommendedIndex,
      bestCoverage: 0,
    };

    const modelResults: ModelResults = { models: allPredictions, recommended, scoring };

    const predictions = allPredictions.map(p => ({
      id: p.id,
      percentiles: p.percentiles,
      confidence: p.confidence,
    }));

    self.postMessage({
      type: 'result',
      payload: {
        modelResults,
        regime: hmmResult.regime,
        predictions,
        recommendedIndex,
      } satisfies VolatilityWorkerResult,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
