import { useState, useCallback, useRef } from 'react';
import { fetchAssetData } from '../providers/twelveDataProvider';
import type { AssetData, HistoricalPrice } from '../types/asset';

interface UseEtfDataReturn {
  etfData: AssetData | null;
  etfAnnualizedReturn: number | null;
  isLoading: boolean;
  error: string | null;
  fetchEtf: (ticker: string) => Promise<void>;
}

/** Compute CAGR from sorted historical prices (oldest→newest). */
export function computeCAGR(prices: HistoricalPrice[]): number | null {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].close;
  const last = sorted[sorted.length - 1].close;
  if (first <= 0 || last <= 0) return null;
  const tradingYears = sorted.length / 252;
  return (Math.pow(last / first, 1 / tradingYears) - 1) * 100;
}

export function useEtfData(): UseEtfDataReturn {
  const [etfData, setEtfData] = useState<AssetData | null>(null);
  const [etfAnnualizedReturn, setEtfAnnualizedReturn] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEtf = useCallback(async (ticker: string): Promise<void> => {
    if (!ticker.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAssetData(ticker.toUpperCase().trim(), controller.signal);
      if (controller.signal.aborted) return;
      setEtfData(response.assetData);
      setEtfAnnualizedReturn(computeCAGR(response.assetData.historicalPrices));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setEtfData(null);
      setEtfAnnualizedReturn(null);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  return { etfData, etfAnnualizedReturn, isLoading, error, fetchEtf };
}
