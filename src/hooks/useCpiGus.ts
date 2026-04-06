import { useState, useEffect, useRef } from 'react';

export interface CpiData {
  rate: number;   // annual % (e.g. 3.6)
  period: string; // e.g. "2024"
  source: string; // "GUS BDL"
}

// Variable 217230 = "Wskaźnik cen towarów i usług konsumpcyjnych, ogółem" (CPI total, Poland)
// Returns index relative to previous year (100 = no change, 103.6 = 3.6% inflation)
const GUS_URL =
  'https://bdl.stat.gov.pl/api/v1/data/by-variable/217230?format=json&unit-Id=000000000000';

export function useCpiGus(onData?: (d: CpiData) => void) {
  const [data, setData] = useState<CpiData | null>(null);
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
        const res = await fetch(GUS_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const values: Array<{ year: string; val: number; attrId: number }> =
          json?.results?.[0]?.values;

        if (!values?.length) throw new Error('Brak danych CPI z GUS');

        // Find last entry with attrId=1 (confirmed data, not preliminary attrId=2)
        // Fall back to last available if none confirmed
        const confirmed = values.filter((v) => v.attrId === 1);
        const latest = confirmed.length ? confirmed[confirmed.length - 1] : values[values.length - 1];

        if (typeof latest.val !== 'number') throw new Error('Brak wartości CPI');

        // val is index: 103.6 means 3.6% YoY inflation
        const rate = parseFloat((latest.val - 100).toFixed(1));

        if (cancelled) return;
        const result: CpiData = { rate, period: latest.year, source: 'GUS BDL' };
        setData(result);
        callbackRef.current?.(result);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Błąd pobierania CPI z GUS');
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
