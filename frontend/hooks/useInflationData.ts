import { useState, useEffect } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface InflationData {
  currentRate: number;  // latest monthly YoY % (e.g. 2.5)
  period: string;       // e.g. "2025-12"
  source: string;       // "GUS CPI" or "cel NBP (fallback)"
  isStale?: boolean;    // true when data is older than 6 months
}

// NBP official inflation target — used as fallback when API is unavailable
const NBP_TARGET_RATE = 2.5;

interface GusInflationPoint {
  year: number;
  month: number;
  cpi_yoy_pct: number;
}

interface GusInflationResponse {
  data: GusInflationPoint[];
}

/** Returns true if the period (YYYY-MM) is older than 6 months from today. */
function isStaleData(period: string): boolean {
  if (!period) return false;
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return false;
  const dataDate = new Date(year, month - 1, 1);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return dataDate < sixMonthsAgo;
}

export function useInflationData() {
  const [data, setData] = useState<InflationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchWithTimeout('/api/v1/finance/inflation', controller.signal);
        if (!res.ok) throw new Error(`GUS CPI HTTP ${res.status}`);

        const json = (await res.json()) as GusInflationResponse;
        const points = json.data;
        if (!points?.length) throw new Error('Brak danych GUS CPI');

        // Take the latest data point (array is ordered ascending)
        const latest = points[points.length - 1];
        const period = `${latest.year}-${String(latest.month).padStart(2, '0')}`;

        if (cancelled) return;
        setData({
          currentRate: latest.cpi_yoy_pct,
          period,
          source: 'GUS CPI',
          isStale: isStaleData(period),
        });
      } catch (err) {
        if (cancelled) return;

        // Fallback to NBP target
        setData({
          currentRate: NBP_TARGET_RATE,
          period: '',
          source: 'cel NBP (fallback)',
        });
        setError(err instanceof Error ? err.message : 'Błąd pobierania danych GUS CPI');
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
