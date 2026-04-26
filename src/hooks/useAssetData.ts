import { useState, useCallback, useRef } from 'react';
import { fetchAssetData } from '../providers/twelveDataProvider';
import type { AssetData } from '../types/asset';
import type { FxRate } from '../providers/nbpProvider';
import { toErrorMessage } from '../utils/formatting';

interface ProxyFxData {
  currentRate: number;
  historicalRates: FxRate[];
}

interface UseAssetDataReturn {
  assetData: AssetData | null;
  proxyFxData: ProxyFxData | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (ticker: string) => Promise<AssetData | null>;
}

export function useAssetData(): UseAssetDataReturn {
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [proxyFxData, setProxyFxData] = useState<ProxyFxData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (ticker: string): Promise<AssetData | null> => {
    if (!ticker.trim()) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchAssetData(ticker.toUpperCase().trim(), controller.signal);
      if (controller.signal.aborted) return null;
      setAssetData(response.assetData);
      setProxyFxData(response.fxData);
      return response.assetData;
    } catch (err) {
      if (controller.signal.aborted) return null;
      setError(toErrorMessage(err));
      setAssetData(null);
      setProxyFxData(null);
      return null;
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  return { assetData, proxyFxData, isLoading, error, fetchData };
}

