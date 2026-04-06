import { useState, useCallback, useRef } from 'react';
import { fetchAssetData } from '../providers/twelveDataProvider';
import type { AssetData } from '../types/asset';

interface UseAssetDataReturn {
  assetData: AssetData | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (ticker: string, apiKey: string) => Promise<AssetData | null>;
}

export function useAssetData(): UseAssetDataReturn {
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (ticker: string, apiKey: string): Promise<AssetData | null> => {
    if (!ticker.trim() || !apiKey.trim()) return null;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAssetData(ticker.toUpperCase().trim(), apiKey.trim(), controller.signal);
      if (controller.signal.aborted) return null;
      setAssetData(data);
      return data;
    } catch (err) {
      if (controller.signal.aborted) return null;
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setAssetData(null);
      return null;
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  return { assetData, isLoading, error, fetchData };
}
