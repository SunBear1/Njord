import { useState, useCallback, useRef } from 'react';
import { fetchAssetData } from '../providers/twelveDataProvider';
import type { AssetData } from '../types/asset';
import type { AnalyzeResult } from '../types/analyze';

interface UseAssetDataReturn {
  assetData: AssetData | null;
  analyzeResult: AnalyzeResult | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (ticker: string, horizonMonths: number) => Promise<AssetData | null>;
}

export function useAssetData(): UseAssetDataReturn {
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (ticker: string, horizonMonths: number): Promise<AssetData | null> => {
    if (!ticker.trim()) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAssetData(ticker.toUpperCase().trim(), horizonMonths, controller.signal);
      if (controller.signal.aborted) return null;
      setAssetData(response.assetData);
      setAnalyzeResult(response.analyzeResult);
      return response.assetData;
    } catch (err) {
      if (controller.signal.aborted) return null;
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setAssetData(null);
      setAnalyzeResult(null);
      return null;
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  return { assetData, analyzeResult, isLoading, error, fetchData };
}

