import { useState, useEffect } from 'react';
import { fetchFxData } from '../providers/nbpProvider';
import type { FxData } from '../providers/nbpProvider';

interface UseFxDataReturn {
  fxData: FxData | null;
  isLoading: boolean;
  error: string | null;
}

export function useFxData(): UseFxDataReturn {
  // isLoading starts true since the effect fires immediately
  const [fxData, setFxData] = useState<FxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFxData('USD')
      .then((data) => {
        if (cancelled) return;
        setFxData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Błąd NBP API');
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { fxData, isLoading, error };
}
