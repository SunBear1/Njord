import { useState, useCallback } from 'react';
import { fetchAssetData } from '../providers/yahooFinanceProvider';
import type { AssetData } from '../types/asset';

interface UseAssetDataReturn {
  assetData: AssetData | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (ticker: string) => Promise<void>;
  clearData: () => void;
}

export function useAssetData(): UseAssetDataReturn {
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (ticker: string) => {
    if (!ticker.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAssetData(ticker.toUpperCase().trim());
      setAssetData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nieznany błąd');
      setAssetData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setAssetData(null);
    setError(null);
  }, []);

  return { assetData, isLoading, error, fetchData, clearData };
}
