import { useMemo } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';
import type { RegimeInfo } from '../utils/hmm';
import type { ModelResults, PredictionResult } from '../utils/models/types';
import { bootstrapPredict } from '../utils/models/bootstrap';
import { garchPredict } from '../utils/models/garch';
import { hmmPredict } from '../utils/models/hmmModel';
import { selectBestModel } from '../utils/models/modelSelector';

export interface VolatilityStats {
  stockSigmaAnnual: number; // annualized σ in %
  fxSigmaAnnual: number;
  correlation: number; // Pearson ρ between daily returns
  stockMeanAnnual: number; // annualized mean return in %
  fxMeanAnnual: number;
  horizonScale: number; // √(months/12)
  regime: RegimeInfo | null;
  /** Multi-model predictions + recommendation */
  models: ModelResults | null;
  /** Pre-computed scenarios per model id (for tab switching) */
  modelScenarios: Record<string, Scenarios>;
}

export interface VolatilityResult {
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

/** Convert a PredictionResult's percentiles into Scenarios with FX correlation */
function toScenarios(pred: PredictionResult, rho: number, fxMagPct: number): Scenarios {
  const [p5, , , , p95] = pred.percentiles;
  return {
    bear: { deltaStock: p5, deltaFx: -rho * fxMagPct },
    base: { deltaStock: 0, deltaFx: 0 },
    bull: { deltaStock: p95, deltaFx: +rho * fxMagPct },
  };
}

export function useHistoricalVolatility(
  stockHistory: HistoricalPrice[] | null,
  fxHistory: FxRate[] | null,
  horizonMonths: number,
): VolatilityResult {
  return useMemo(() => {
    if (!stockHistory || !fxHistory) return { stats: null, suggestedScenarios: null };

    const stockPrices = stockHistory.map((p) => p.close);
    const stockReturns = dailyReturns(stockPrices);
    const fxReturns = dailyReturns(fxHistory.map((r) => r.rate));

    if (stockReturns.length < 5 || fxReturns.length < 5) {
      return { stats: null, suggestedScenarios: null };
    }

    const stockDailySigma = stddev(stockReturns);
    const fxDailySigma = stddev(fxReturns);
    const rho = pearsonCorrelation(stockReturns, fxReturns);

    // Annualize
    const stockSigmaAnnual = stockDailySigma * Math.sqrt(252) * 100;
    const fxSigmaAnnual = fxDailySigma * Math.sqrt(252) * 100;
    const stockMeanAnnual = mean(stockReturns) * 252 * 100;
    const fxMeanAnnual = mean(fxReturns) * 252 * 100;

    const T = horizonMonths / 12;
    const fxSigma = fxSigmaAnnual / 100;

    const stockLogRet = logReturns(stockPrices);
    const seed = dataSeed(stockPrices);
    const horizonDays = Math.round(horizonMonths * 21);

    // FX magnitude for scenario construction (shared by all models)
    const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

    // Run all three models
    const bootstrapResult = bootstrapPredict(stockLogRet, horizonDays, seed);
    const garchResult = garchPredict(stockLogRet, horizonDays, seed + 10);
    const hmmResult = hmmPredict(stockLogRet, horizonDays, seed);

    const allPredictions = [bootstrapResult, garchResult, hmmResult.prediction];

    // Model selection via out-of-sample backtest
    const scoring = selectBestModel(stockLogRet, horizonDays, seed, allPredictions);
    const recommended = scoring.scored[scoring.recommendedIndex];

    const modelResults: ModelResults = {
      models: scoring.scored,
      recommended,
      scoring,
    };

    // Pre-compute scenarios for each model (for tab switching in UI)
    const modelScenarios: Record<string, Scenarios> = {};
    for (const pred of scoring.scored) {
      if (pred.confidence > 0) {
        modelScenarios[pred.id] = toScenarios(pred, rho, fxMagPct);
      }
    }

    // Use recommended model's percentiles for suggested scenarios
    const suggestedScenarios = recommended.confidence > 0
      ? toScenarios(recommended, rho, fxMagPct)
      : toScenarios(bootstrapResult, rho, fxMagPct); // fallback to bootstrap

    const stats: VolatilityStats = {
      stockSigmaAnnual,
      fxSigmaAnnual,
      correlation: rho,
      stockMeanAnnual,
      fxMeanAnnual,
      horizonScale: Math.sqrt(T),
      regime: hmmResult.regime,
      models: modelResults,
      modelScenarios,
    };

    return { stats, suggestedScenarios };
  }, [stockHistory, fxHistory, horizonMonths]);
}
