import { useMemo } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';
import {
  fitGaussianHmm,
  detectCurrentRegime,
  regimeConditionedMonteCarlo,
  type RegimeInfo,
} from '../utils/hmm';

export interface VolatilityStats {
  stockSigmaAnnual: number; // annualized σ in %
  fxSigmaAnnual: number;
  correlation: number; // Pearson ρ between daily returns
  stockMeanAnnual: number; // annualized mean return in %
  fxMeanAnnual: number;
  horizonScale: number; // √(months/12)
  regime: RegimeInfo | null;
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

    // Attempt HMM regime detection on log-returns
    const stockLogRet = logReturns(stockPrices);
    const seed = dataSeed(stockPrices);
    const hmmModel = fitGaussianHmm(stockLogRet, 2, seed);

    let regime: RegimeInfo | null = null;
    let suggestedScenarios: Scenarios;

    if (hmmModel) {
      // HMM succeeded — use regime-conditioned Monte Carlo
      regime = detectCurrentRegime(stockLogRet, hmmModel);

      const horizonDays = Math.round(horizonMonths * 21); // ~21 trading days/month
      const mc = regimeConditionedMonteCarlo(hmmModel, regime.currentState, horizonDays, 3000, seed + 1);

      const [p5, , p50, , p95] = mc.percentiles;

      // FX: correlation-adjusted magnitude (same approach as before)
      const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

      suggestedScenarios = {
        bear: { deltaStock: p5, deltaFx: -rho * fxMagPct },
        base: { deltaStock: p50, deltaFx: 0 },
        bull: { deltaStock: p95, deltaFx: +rho * fxMagPct },
      };
    } else {
      // Fallback: original log-normal p5/p95 approach
      const stockSigma = stockSigmaAnnual / 100;
      const itoAdj = (s: number) => -(s * s) / 2 * T;
      const stockBearPct = (Math.exp(-1.645 * stockSigma * Math.sqrt(T) + itoAdj(stockSigma)) - 1) * 100;
      const stockBullPct = (Math.exp(+1.645 * stockSigma * Math.sqrt(T) + itoAdj(stockSigma)) - 1) * 100;
      const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + (-(fxSigma * fxSigma) / 2) * T) - 1) * 100;

      suggestedScenarios = {
        bear: { deltaStock: stockBearPct, deltaFx: -rho * fxMagPct },
        base: { deltaStock: 0, deltaFx: 0 },
        bull: { deltaStock: stockBullPct, deltaFx: +rho * fxMagPct },
      };
    }

    const stats: VolatilityStats = {
      stockSigmaAnnual,
      fxSigmaAnnual,
      correlation: rho,
      stockMeanAnnual,
      fxMeanAnnual,
      horizonScale: Math.sqrt(T),
      regime,
    };

    return { stats, suggestedScenarios };
  }, [stockHistory, fxHistory, horizonMonths]);
}
