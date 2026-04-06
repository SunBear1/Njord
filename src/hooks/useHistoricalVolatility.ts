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

    // Scale to horizon
    const horizonScale = Math.sqrt(horizonMonths / 12);
    const stockH = stockSigmaAnnual * horizonScale;
    const fxH = fxSigmaAnnual * horizonScale;

    // Scale mean to horizon (linear for short periods)
    const stockMeanH = stockMeanAnnual * (horizonMonths / 12);
    const fxMeanH = fxMeanAnnual * (horizonMonths / 12);

    // Correlation-aware FX deltas:
    // Bear: stock at -σ → E[ΔFX | ΔS = -σ_S] = -ρ × σ_FX (negative sign!)
    // Bull: stock at +σ → E[ΔFX | ΔS = +σ_S] = +ρ × σ_FX
    // With ρ<0: Bear FX goes up (USD strengthens, amortises loss). Bull FX goes down.
    const fxBearDelta = -rho * fxH;
    const fxBullDelta = rho * fxH;

    const suggestedScenarios: Scenarios = {
      bear: { deltaStock: -stockH, deltaFx: fxBearDelta },
      base: { deltaStock: stockMeanH, deltaFx: fxMeanH },
      bull: { deltaStock: stockH, deltaFx: fxBullDelta },
    };

    const stats: VolatilityStats = {
      stockSigmaAnnual,
      fxSigmaAnnual,
      correlation: rho,
      stockMeanAnnual,
      fxMeanAnnual,
      horizonScale,
    };

    return { stats, suggestedScenarios };
  }, [stockHistory, fxHistory, horizonMonths]);
}
