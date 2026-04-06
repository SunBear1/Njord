import { useState, useEffect } from 'react';
import { fetchFxData } from '../providers/nbpProvider';
import type { FxData } from '../providers/nbpProvider';

interface UseFxDataReturn {
  fxData: FxData | null;
  isLoading: boolean;
  error: string | null;
}

export function useFxData(): UseFxDataReturn {
  const [fxData, setFxData] = useState<FxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchFxData('USD')
      .then(setFxData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Błąd NBP API'))
      .finally(() => setIsLoading(false));
  }, []);

  return { fxData, isLoading, error };
}
