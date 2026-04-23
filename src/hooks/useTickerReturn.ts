/**
 * Hook to fetch historical data for a ticker and suggest an expected annual return.
 *
 * Wraps the existing /api/analyze endpoint + GBM calibration to produce
 * a data-backed return estimate for the Accumulation Planner's stocks instrument.
 */

import { useState, useCallback, useRef } from 'react';
import { fetchAssetData } from '../providers/twelveDataProvider';
import { gbmPredict } from '../utils/models/gbmModel';

interface TickerReturnResult {
  /** Suggested annualized return % from GBM calibration (base/median scenario). */
  suggestedReturn: number | null;
  /** Ticker name resolved from the API. */
  tickerName: string | null;
  /** Current price in USD. */
  currentPrice: number | null;
  isLoading: boolean;
  error: string | null;
  fetchReturn: (ticker: string) => Promise<void>;
}

function logReturns(prices: number[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      ret.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return ret;
}

export function useTickerReturn(): TickerReturnResult {
  const [suggestedReturn, setSuggestedReturn] = useState<number | null>(null);
  const [tickerName, setTickerName] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchReturn = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchAssetData(ticker.toUpperCase().trim(), controller.signal);
      if (controller.signal.aborted) return;

      const { assetData } = response;
      setTickerName(assetData.asset.name);
      setCurrentPrice(assetData.asset.currentPrice);

      // Run GBM calibration on historical prices
      const prices = assetData.historicalPrices.map(p => p.close);
      if (prices.length < 30) {
        setError('Za mało danych historycznych');
        setSuggestedReturn(null);
        return;
      }

      const logRet = logReturns(prices);
      const n = logRet.length;
      const mean = logRet.reduce((a, b) => a + b, 0) / n;
      const variance = logRet.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1);
      const dailySigma = Math.sqrt(variance);
      const annualSigma = dailySigma * Math.sqrt(252);
      const annualMean = mean * 252;
      const dataYears = n / 252;

      const prediction = gbmPredict(annualSigma, annualMean, dataYears, 1);

      // Use the base (median / p50) scenario as the suggested annual return
      const baseReturn = prediction.percentiles[2]; // p50
      setSuggestedReturn(Math.round(baseReturn * 10) / 10);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setSuggestedReturn(null);
      setTickerName(null);
      setCurrentPrice(null);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  return { suggestedReturn, tickerName, currentPrice, isLoading, error, fetchReturn };
}
