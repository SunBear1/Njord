import { useMemo } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';

export interface VolatilityStats {
  stockSigmaAnnual: number; // annualized σ in %
  fxSigmaAnnual: number;
  correlation: number; // Pearson ρ between daily returns
  stockMeanAnnual: number; // annualized mean return in %
  fxMeanAnnual: number;
  horizonScale: number; // √(months/12)
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

export function useHistoricalVolatility(
  stockHistory: HistoricalPrice[] | null,
  fxHistory: FxRate[] | null,
  horizonMonths: number,
): VolatilityResult {
  return useMemo(() => {
    if (!stockHistory || !fxHistory) return { stats: null, suggestedScenarios: null };

    const stockReturns = dailyReturns(stockHistory.map((p) => p.close));
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
    const stockSigma = stockSigmaAnnual / 100; // decimal
    const fxSigma = fxSigmaAnnual / 100;

    // Log-normal p5/p95 with zero drift (conservative, avoids projecting noisy recent trend).
    // ln(P_T/P_0) ~ N(-σ²/2·T, σ²·T)  [zero-drift GBM with Itô correction]
    // p5  (Bear): exp(-1.645·σ·√T - σ²/2·T) - 1
    // p95 (Bull): exp(+1.645·σ·√T - σ²/2·T) - 1
    const itoAdj = (s: number) => -(s * s) / 2 * T;
    const stockBearPct = (Math.exp(-1.645 * stockSigma * Math.sqrt(T) + itoAdj(stockSigma)) - 1) * 100;
    const stockBullPct = (Math.exp(+1.645 * stockSigma * Math.sqrt(T) + itoAdj(stockSigma)) - 1) * 100;

    // FX magnitude: p95 of log-normal (symmetric ±)
    const fxMagPct = (Math.exp(1.645 * fxSigma * Math.sqrt(T) + itoAdj(fxSigma)) - 1) * 100;

    // Correlation-adjusted FX deltas (same sign convention as fixed Bug F):
    // Bear: stock falls → E[ΔFXR] = -ρ · fxMag
    // Bull: stock rises → E[ΔFXR] = +ρ · fxMag
    const fxBearDelta = -rho * fxMagPct;
    const fxBullDelta = +rho * fxMagPct;

    // Base: zero drift for both (historical mean is too noisy over ~1 year to reliably project).
    // The trend (stockMeanAnnual) is shown as info in the UI — user can incorporate it manually.
    const suggestedScenarios: Scenarios = {
      bear: { deltaStock: stockBearPct, deltaFx: fxBearDelta },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: stockBullPct, deltaFx: fxBullDelta },
    };

    const stats: VolatilityStats = {
      stockSigmaAnnual,
      fxSigmaAnnual,
      correlation: rho,
      stockMeanAnnual,
      fxMeanAnnual,
      horizonScale: Math.sqrt(T),
    };

    return { stats, suggestedScenarios };
  }, [stockHistory, fxHistory, horizonMonths]);
}
