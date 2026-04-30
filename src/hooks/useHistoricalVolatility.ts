import { useMemo, useState, useEffect, useRef } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';
import type { RegimeInfo } from '../utils/hmm';
import type { ModelResults, PredictionResult } from '../utils/models/types';
import { clampScenario } from '../utils/models/gbmModel';
import { useDebouncedValue } from './useDebouncedValue';
import { TRADING_DAYS_PER_YEAR } from '../utils/assetConfig';
import type { VolatilityWorkerResult } from '../workers/volatility.worker';

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

/** Minimum percentage spread enforced between bear/base/bull scenarios */
const MIN_SCENARIO_SPREAD = 5;

/**
 * Convert a PredictionResult's percentiles into Scenarios with FX correlation.
 *
 * Uses p25/p75 for bear/bull (inter-quartile range — more stable than p5/p95).
 * p50 (median) becomes the base scenario.
 * All values clamped through the GBM sanity bounds.
 * Minimum spread of 5pp is enforced between scenarios to prevent collapse
 * (e.g. for severely declining stocks where multiple percentiles hit the floor).
 */
function toScenarios(pred: PredictionResult, rho: number, fxMagPct: number, horizonYears: number): Scenarios {
  const [, p25, p50, p75] = pred.percentiles;
  let bear = clampScenario(p25, horizonYears);
  let base = clampScenario(p50, horizonYears);
  let bull = clampScenario(p75, horizonYears);

  // Enforce minimum spread so scenarios are always distinct
  if (base < bear + MIN_SCENARIO_SPREAD) base = bear + MIN_SCENARIO_SPREAD;
  if (bull < base + MIN_SCENARIO_SPREAD) bull = base + MIN_SCENARIO_SPREAD;

  // Bear must always be negative to match validateScenarios contract
  bear = Math.min(bear, -MIN_SCENARIO_SPREAD);
  // Bull must always be positive
  bull = Math.max(bull, MIN_SCENARIO_SPREAD);

  return {
    bear:  { deltaStock: bear, deltaFx: clampScenario(-rho * fxMagPct, horizonYears) },
    base:  { deltaStock: base, deltaFx: 0 },
    bull:  { deltaStock: bull, deltaFx: clampScenario(+rho * fxMagPct, horizonYears) },
  };
}

/** Threshold: horizons ≤ this use bootstrap as primary, longer use GBM */
const BOOTSTRAP_HORIZON_MONTHS = 6;

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

    const stockSigmaAnnual = stockDailySigma * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
    const fxSigmaAnnual = fxDailySigma * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;

    const stockLogRet = logReturns(stockPrices);
    // GBM drift parameter μ must be the mean of log-returns (not simple returns).
    // Using arithmetic mean of simple returns would introduce ≈ σ²/2 upward bias.
    const stockMeanAnnual = mean(stockLogRet) * TRADING_DAYS_PER_YEAR * 100;
    const seed = dataSeed(stockPrices);

    return { stockSigmaAnnual, fxSigmaAnnual, rho, stockMeanAnnual, stockLogRet, seed };
  }, [stockHistory, fxHistory]);

  // Phase 2: Model computation — tiered approach:
  //   ≤ 6 months: Bootstrap (primary) + GBM (secondary)
  //   > 6 months: GBM (primary) + Bootstrap (secondary for reference)
  //   HMM: regime detection only, not used for scenario generation
  const [modelResult, setModelResult] = useState<{
    modelResults: ModelResults;
    modelScenarios: Record<string, Scenarios>;
    suggestedScenarios: Scenarios;
    regime: RegimeInfo | null;
  } | null>(null);
  const [computing, setComputing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const handlerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Create the worker once on mount
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../workers/volatility.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!baseStats) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModelResult(null);
      setComputing(false);
      return;
    }

    setComputing(true);
    let cancelled = false;
    const worker = workerRef.current;

    if (worker) {
      // Remove any stale handler from a previous run
      if (handlerRef.current) {
        worker.removeEventListener('message', handlerRef.current);
        handlerRef.current = null;
      }

      const handler = (event: MessageEvent<{ type: string; payload?: VolatilityWorkerResult; message?: string }>) => {
        if (cancelled) return;
        worker.removeEventListener('message', handler);
        handlerRef.current = null;

        if (event.data.type === 'result' && event.data.payload) {
          const { modelResults, regime, predictions, recommendedIndex } = event.data.payload;
          const { rho } = baseStats;
          const T = debouncedHorizon / 12;
          const fxSigma = baseStats.fxSigmaAnnual / 100;
          const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

          // Build per-model scenarios on main thread (cheap — no Monte Carlo)
          const modelScenarios: Record<string, Scenarios> = {};
          for (const pred of predictions) {
            if (pred.confidence > 0) {
              modelScenarios[pred.id] = toScenarios(
                pred as PredictionResult,
                rho, fxMagPct, T,
              );
            }
          }

          const recommendedPred = predictions[recommendedIndex];
          const suggestedScenarios = toScenarios(
            recommendedPred as PredictionResult,
            rho, fxMagPct, T,
          );

          setModelResult({ modelResults, modelScenarios, suggestedScenarios, regime });
        }
        setComputing(false);
      };

      handlerRef.current = handler;
      worker.addEventListener('message', handler);
      worker.postMessage({
        type: 'run',
        payload: {
          stockLogRet: baseStats.stockLogRet,
          stockSigmaAnnual: baseStats.stockSigmaAnnual,
          stockMeanAnnual: baseStats.stockMeanAnnual,
          seed: baseStats.seed,
          debouncedHorizon,
        },
      });
    } else {
      // Fallback: main thread with setTimeout guard (test/SSR environments)
      const timer = setTimeout(() => {
        if (cancelled) return;
        void (async () => {
          try {
            const { bootstrapPredict } = await import('../utils/models/bootstrap');
            const { gbmPredict } = await import('../utils/models/gbmModel');
            const { hmmPredict } = await import('../utils/models/hmmModel');
            const { getRegimeAdjustedPrior } = await import('../utils/models/regimePrior');

            const { rho, stockLogRet, seed } = baseStats;
            const T = debouncedHorizon / 12;
            const fxSigma = baseStats.fxSigmaAnnual / 100;
            const dataYears = stockLogRet.length / TRADING_DAYS_PER_YEAR;
            const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

            const bootstrapHorizonDays = Math.min(Math.round(debouncedHorizon * 21), 504);
            const hmmResult = hmmPredict(stockLogRet, bootstrapHorizonDays, seed);

            const hmmPosteriorBull = hmmResult.regime?.currentRegimeLabel === 'bull'
              ? hmmResult.regime.posteriorProbability
              : hmmResult.regime
                ? 1 - hmmResult.regime.posteriorProbability
                : null;
            const regimePrior = getRegimeAdjustedPrior(hmmPosteriorBull);

            const gbmResult = gbmPredict(
              baseStats.stockSigmaAnnual / 100,
              baseStats.stockMeanAnnual / 100,
              dataYears,
              T,
              regimePrior,
            );
            const bootstrapResult = bootstrapPredict(stockLogRet, bootstrapHorizonDays, seed);

            const allPredictions: PredictionResult[] = [gbmResult, bootstrapResult];
            const useBootstrapPrimary = debouncedHorizon <= BOOTSTRAP_HORIZON_MONTHS;
            const recommendedIndex = useBootstrapPrimary ? 1 : 0;
            const recommended = allPredictions[recommendedIndex];

            const modelResults: ModelResults = {
              models: allPredictions,
              recommended,
              scoring: { scored: allPredictions, recommendedIndex, bestCoverage: 0 },
            };

            const modelScenarios: Record<string, Scenarios> = {};
            for (const pred of allPredictions) {
              if (pred.confidence > 0) {
                modelScenarios[pred.id] = toScenarios(pred, rho, fxMagPct, T);
              }
            }
            const suggestedScenarios = toScenarios(recommended, rho, fxMagPct, T);

            if (!cancelled) {
              setModelResult({ modelResults, modelScenarios, suggestedScenarios, regime: hmmResult.regime });
              setComputing(false);
            }
          } catch {
            if (!cancelled) setComputing(false);
          }
        })();
      }, 50);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    return () => {
      cancelled = true;
      if (worker && handlerRef.current) {
        worker.removeEventListener('message', handlerRef.current);
        handlerRef.current = null;
      }
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
