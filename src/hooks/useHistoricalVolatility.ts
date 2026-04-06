import { useMemo } from 'react';
import type { HistoricalPrice } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import type { Scenarios } from '../types/scenario';

interface VolatilityResult {
  stockSigma: number | null;  // annualized sigma for stock
  fxSigma: number | null;     // annualized sigma for fx
  suggestedScenarios: Scenarios | null;
}

function calcSigma(prices: number[]): number | null {
  if (prices.length < 5) return null;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  if (returns.length < 4) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const dailySigma = Math.sqrt(variance);
  return dailySigma * Math.sqrt(252); // annualized
}

export function useHistoricalVolatility(
  stockHistory: HistoricalPrice[] | null,
  fxHistory: FxRate[] | null,
  horizonMonths: number,
): VolatilityResult {
  return useMemo(() => {
    const stockSigma = stockHistory ? calcSigma(stockHistory.map((p) => p.close)) : null;
    const fxSigma = fxHistory ? calcSigma(fxHistory.map((r) => r.rate)) : null;

    if (!stockSigma || !fxSigma) return { stockSigma, fxSigma, suggestedScenarios: null };

    // Scale to horizon: sigma_horizon = sigma_annual * sqrt(months/12)
    const scale = Math.sqrt(horizonMonths / 12);
    const stockH = stockSigma * scale * 100; // in %
    const fxH = fxSigma * scale * 100;

    const suggestedScenarios: Scenarios = {
      bear: { deltaStock: -stockH, deltaFx: -fxH },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: stockH, deltaFx: fxH },
    };

    return { stockSigma, fxSigma, suggestedScenarios };
  }, [stockHistory, fxHistory, horizonMonths]);
}
