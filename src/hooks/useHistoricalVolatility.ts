import { useMemo, useState, useEffect } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';
import type { RegimeInfo } from '../utils/hmm';
import type { ModelResults, PredictionResult } from '../utils/models/types';
import { bootstrapPredict } from '../utils/models/bootstrap';
import { gbmPredict, clampScenario } from '../utils/models/gbmModel';
import { hmmPredict } from '../utils/models/hmmModel';
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
 * Uses p25/p75 for bear/bull (inter-quartile range — more stable than p5/p95).
 * p50 (median) becomes the base scenario.
 * All values clamped through the GBM sanity bounds.
 */
function toScenarios(pred: PredictionResult, rho: number, fxMagPct: number, horizonYears: number): Scenarios {
  const [, p25, p50, p75] = pred.percentiles;
  return {
    bear:  { deltaStock: clampScenario(p25, horizonYears), deltaFx: clampScenario(-rho * fxMagPct, horizonYears) },
    base:  { deltaStock: clampScenario(p50, horizonYears), deltaFx: 0 },
    bull:  { deltaStock: clampScenario(p75, horizonYears), deltaFx: clampScenario(+rho * fxMagPct, horizonYears) },
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

    const stockSigmaAnnual = stockDailySigma * Math.sqrt(252) * 100;
    const fxSigmaAnnual = fxDailySigma * Math.sqrt(252) * 100;
    const stockMeanAnnual = mean(stockReturns) * 252 * 100;

    const stockLogRet = logReturns(stockPrices);
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
      const T = debouncedHorizon / 12; // horizon in years
      const fxSigma = baseStats.fxSigmaAnnual / 100;
      const dataYears = stockLogRet.length / 252;

      // FX magnitude for scenario correlation
      const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

      // ── Model 1: GBM (closed-form, works for all horizons) ────────────
      const gbmResult = gbmPredict(
        baseStats.stockSigmaAnnual / 100,
        baseStats.stockMeanAnnual / 100,
        dataYears,
        T,
      );

      // ── Model 2: Bootstrap (Monte Carlo, best for short horizons) ─────
      const bootstrapHorizonDays = Math.min(Math.round(debouncedHorizon * 21), 504);
      const bootstrapResult = bootstrapPredict(stockLogRet, bootstrapHorizonDays, seed);

      // ── Model 3: HMM (regime detection only — info display) ───────────
      const hmmResult = hmmPredict(stockLogRet, bootstrapHorizonDays, seed);
      // Reduce HMM confidence to signal it's informational only
      hmmResult.prediction.confidence = Math.min(hmmResult.prediction.confidence * 0.3, 0.25);
      hmmResult.prediction.description += ' [Informacyjny — zbyt mało danych dla wiarygodnych scenariuszy]';

      // ── Tiered selection ───────────────────────────────────────────────
      const allPredictions = [gbmResult, bootstrapResult, hmmResult.prediction];
      const useBootstrapPrimary = debouncedHorizon <= BOOTSTRAP_HORIZON_MONTHS;
      const recommendedIndex = useBootstrapPrimary ? 1 : 0;
      const recommended = allPredictions[recommendedIndex];

      const scoring = {
        scored: allPredictions,
        recommendedIndex,
        bestCoverage: 0,
      };

      const modelResults: ModelResults = { models: allPredictions, recommended, scoring };

      // Build per-model scenarios for tab switching
      const modelScenarios: Record<string, Scenarios> = {};
      for (const pred of allPredictions) {
        if (pred.confidence > 0) {
          modelScenarios[pred.id] = toScenarios(pred, rho, fxMagPct, T);
        }
      }

      const suggestedScenarios = toScenarios(recommended, rho, fxMagPct, T);

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
