import { useState, useEffect, useRef } from 'react';

export interface InflationData {
  rate: number;   // annual % (e.g. 2.5)
  period: string; // e.g. "2025-12"
  source: string; // e.g. "ECB HICP"
}

const ECB_URL =
  'https://data-api.ecb.europa.eu/service/data/ICP/M.PL.N.000000.4.ANR?lastNObservations=1&format=jsondata';

export function useInflationData(onData?: (d: InflationData) => void) {
  const [data, setData] = useState<InflationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onData);
  callbackRef.current = onData;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(ECB_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const series = json?.dataSets?.[0]?.series?.['0:0:0:0:0:0'];
        const obs = series?.observations;
        if (!obs) throw new Error('Brak danych');

        // Get the last observation key and value
        const keys = Object.keys(obs);
        const lastKey = keys[keys.length - 1];
        const rate = obs[lastKey]?.[0];
        if (typeof rate !== 'number') throw new Error('Brak wartości inflacji');

        // Get time period from dimensions
        const timeDim = json?.structure?.dimensions?.observation?.find(
          (d: { id: string }) => d.id === 'TIME_PERIOD',
        );
        const period = timeDim?.values?.[Number(lastKey)]?.id || 'nieznany';

        if (cancelled) return;
        const result: InflationData = { rate, period, source: 'ECB HICP' };
        setData(result);
        callbackRef.current?.(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Błąd pobierania inflacji');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { data, isLoading, error };
}
