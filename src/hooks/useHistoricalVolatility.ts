import { useMemo, useState, useEffect } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';
import type { RegimeInfo } from '../utils/hmm';
import type { ModelResults, PredictionResult, Percentiles } from '../utils/models/types';
import { bootstrapPredict } from '../utils/models/bootstrap';
import { garchPredict } from '../utils/models/garch';
import { hmmPredict } from '../utils/models/hmmModel';
import { selectBestModel } from '../utils/models/modelSelector';
import { useDebouncedValue } from './useDebouncedValue';

export interface VolatilityStats {
  stockSigmaAnnual: number; // annualized σ in %
  fxSigmaAnnual: number;
  correlation: number; // Pearson ρ between daily returns
  stockMeanAnnual: number; // annualized mean return in %
  regime: RegimeInfo | null;
  /** Multi-model predictions + recommendation */
  models: ModelResults | null;
  /** Pre-computed scenarios per model id (for tab switching) */
  modelScenarios: Record<string, Scenarios>;
  /** True while models are recomputing after horizon change */
  modelsLoading: boolean;
}

interface VolatilityResult {
  stats: VolatilityStats | null;
  suggestedScenarios: Scenarios | null;
}

function dailyReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) ret.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return ret;
}

function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) ret.push(Math.log(prices[i] / prices[i - 1]));
  }
  return ret;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const ma = mean(ax), mb = mean(bx);
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - ma, db = bx[i] - mb;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

/** Derive a deterministic seed from the data for reproducible Monte Carlo */
function dataSeed(prices: number[]): number {
  let h = 0;
  for (let i = 0; i < prices.length; i++) {
    h = ((h << 5) - h + Math.round(prices[i] * 100)) | 0;
  }
  return Math.abs(h);
}

/**
 * Convert a PredictionResult's percentiles into Scenarios with FX correlation.
 *
 * Uses p25/p75 (IQR) for bear/bull instead of p5/p95 (extreme tails).
 * p50 (median) becomes the base scenario so model predictions are actually used.
 * Hard clamps prevent absurd outputs for volatile stocks or long horizons.
 */
const MAX_SCENARIO_UP = 300;   // max +300% (4× price)
const MAX_SCENARIO_DOWN = -90; // max -90%

function clampDelta(v: number): number {
  return Math.max(MAX_SCENARIO_DOWN, Math.min(MAX_SCENARIO_UP, v));
}

function toScenarios(pred: PredictionResult, rho: number, fxMagPct: number): Scenarios {
  const [, p25, p50, p75] = pred.percentiles;
  return {
    bear:  { deltaStock: clampDelta(p25), deltaFx: clampDelta(-rho * fxMagPct) },
    base:  { deltaStock: clampDelta(p50), deltaFx: 0 },
    bull:  { deltaStock: clampDelta(p75), deltaFx: clampDelta(+rho * fxMagPct) },
  };
}

/** Max trading days for model simulation — beyond this, extrapolate with √T scaling */
const MAX_MODEL_DAYS = 504;

/** Scale model percentiles from modelDays to targetDays using mean+volatility decomposition.
 *  Clamps the output to prevent absurd extrapolations at very long horizons. */
function scalePercentiles(pcts: Percentiles, modelDays: number, targetDays: number): Percentiles {
  const timeRatio = targetDays / modelDays;
  const sqrtRatio = Math.sqrt(timeRatio);
  const logR = pcts.map(p => Math.log(Math.max(1e-10, 1 + p / 100)));
  const medianLog = logR[2]; // p50
  return logR.map(lr => {
    const deviation = lr - medianLog;
    const scaled = medianLog * timeRatio + deviation * sqrtRatio;
    // Clamp log-return to prevent exp() overflow: ±ln(5) ≈ 1.6 → max ~400%
    const clamped = Math.max(-3, Math.min(Math.log(5), scaled));
    return (Math.exp(clamped) - 1) * 100;
  }) as unknown as Percentiles;
}

export function useHistoricalVolatility(
  stockHistory: HistoricalPrice[] | null,
  fxHistory: FxRate[] | null,
  horizonMonths: number,
): VolatilityResult {
  // Debounce horizon for expensive model computation (600ms after slider stops)
  const debouncedHorizon = useDebouncedValue(horizonMonths, 600);

  // Phase 1: Cheap statistics — recompute immediately on any change
  const baseStats = useMemo(() => {
    if (!stockHistory || !fxHistory) return null;

    const stockPrices = stockHistory.map((p) => p.close);
    const stockReturns = dailyReturns(stockPrices);
    const fxReturns = dailyReturns(fxHistory.map((r) => r.rate));

    if (stockReturns.length < 5 || fxReturns.length < 5) return null;

    const stockDailySigma = stddev(stockReturns);
    const fxDailySigma = stddev(fxReturns);
    const rho = pearsonCorrelation(stockReturns, fxReturns);

    const stockSigmaAnnual = stockDailySigma * Math.sqrt(252) * 100;
    const fxSigmaAnnual = fxDailySigma * Math.sqrt(252) * 100;
    const stockMeanAnnual = mean(stockReturns) * 252 * 100;

    const stockLogRet = logReturns(stockPrices);
    const seed = dataSeed(stockPrices);

    return { stockSigmaAnnual, fxSigmaAnnual, rho, stockMeanAnnual, stockLogRet, seed };
  }, [stockHistory, fxHistory]);

  // Phase 2: Heavy model computation — deferred to avoid blocking UI during slider drag.
  // Uses setTimeout(0) to yield the main thread between the React render and the computation,
  // keeping the slider responsive while models recompute.
  const [modelResult, setModelResult] = useState<{
    modelResults: ModelResults;
    modelScenarios: Record<string, Scenarios>;
    suggestedScenarios: Scenarios;
    regime: RegimeInfo | null;
  } | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    if (!baseStats) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelResult(null);
      setComputing(false);
      return;
    }

    setComputing(true);

    const timer = setTimeout(() => {
      const { rho, stockLogRet, seed } = baseStats;
      const T = debouncedHorizon / 12;
      const fxSigma = baseStats.fxSigmaAnnual / 100;
      const rawHorizonDays = Math.round(debouncedHorizon * 21);
      const modelDays = Math.min(rawHorizonDays, MAX_MODEL_DAYS);

      const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

      const bootstrapResult = bootstrapPredict(stockLogRet, modelDays, seed);
      const garchResult = garchPredict(stockLogRet, modelDays, seed + 10);
      const hmmResult = hmmPredict(stockLogRet, modelDays, seed);

      const allPredictions = [bootstrapResult, garchResult, hmmResult.prediction];
      const scoring = selectBestModel(stockLogRet, modelDays, seed, allPredictions);

      // Scale percentiles for horizons beyond MAX_MODEL_DAYS (√T extrapolation with dampened confidence)
      if (rawHorizonDays > MAX_MODEL_DAYS) {
        const damp = Math.sqrt(MAX_MODEL_DAYS / rawHorizonDays);
        for (const pred of scoring.scored) {
          pred.percentiles = scalePercentiles(pred.percentiles, modelDays, rawHorizonDays);
          pred.confidence *= damp;
        }
      }

      const recommended = scoring.scored[scoring.recommendedIndex];
      const modelResults: ModelResults = { models: scoring.scored, recommended, scoring };

      const modelScenarios: Record<string, Scenarios> = {};
      for (const pred of scoring.scored) {
        if (pred.confidence > 0) {
          modelScenarios[pred.id] = toScenarios(pred, rho, fxMagPct);
        }
      }

      const suggestedScenarios = recommended.confidence > 0
        ? toScenarios(recommended, rho, fxMagPct)
        : toScenarios(scoring.scored[0], rho, fxMagPct);

      setModelResult({ modelResults, modelScenarios, suggestedScenarios, regime: hmmResult.regime });
      setComputing(false);
    }, 0);

    return () => {
      clearTimeout(timer);
      setComputing(false);
    };
  }, [baseStats, debouncedHorizon]);

  // Are models still computing for a new horizon?
  const modelsLoading = baseStats != null && (debouncedHorizon !== horizonMonths || computing);

  if (!baseStats) {
    return { stats: null, suggestedScenarios: null };
  }

  const stats: VolatilityStats = {
    stockSigmaAnnual: baseStats.stockSigmaAnnual,
    fxSigmaAnnual: baseStats.fxSigmaAnnual,
    correlation: baseStats.rho,
    stockMeanAnnual: baseStats.stockMeanAnnual,
    regime: modelResult?.regime ?? null,
    models: modelResult?.modelResults ?? null,
    modelScenarios: modelResult?.modelScenarios ?? {},
    modelsLoading,
  };

  return { stats, suggestedScenarios: modelResult?.suggestedScenarios ?? null };
}
