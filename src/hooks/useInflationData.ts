import { useState, useEffect } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
export interface InflationData {
  currentRate: number;  // latest monthly YoY % (e.g. 2.5)
  period: string;       // e.g. "2025-12"
  source: string;       // "Eurostat HICP" or "NBP target (fallback)"
  isStale?: boolean;    // true when data is older than 6 months
}

// NBP official inflation target — used as fallback when API is unavailable
const NBP_TARGET_RATE = 2.5;

function parseCsvRow(csv: string): { rate: number; period: string } | null {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return null;

  const header = lines[0].split(',');
  const periodIdx = header.indexOf('TIME_PERIOD');
  const valueIdx = header.indexOf('OBS_VALUE');
  if (periodIdx < 0 || valueIdx < 0) return null;

  const row = lines[lines.length - 1].split(',');
  const rate = parseFloat(row[valueIdx]);
  const period = row[periodIdx];

  if (isNaN(rate) || !period) return null;
  return { rate, period };
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

// ECB direct URL — used as fallback when proxy is unavailable
const ECB_URL =
  'https://data-api.ecb.europa.eu/service/data/ICP/M.PL.N.000000.4.ANR?format=csvdata&lastNObservations=1';

async function fetchInflationCsv(signal: AbortSignal): Promise<string> {
  // Try proxy first (edge-cached), fall back to ECB direct
  try {
    const proxyRes = await fetchWithTimeout('/api/inflation', signal);
    if (proxyRes.ok) return await proxyRes.text();
  } catch { /* fall through */ }

  const directRes = await fetchWithTimeout(ECB_URL, signal);
  if (!directRes.ok) throw new Error(`ECB HTTP ${directRes.status}`);
  return await directRes.text();
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
        const csv = await fetchInflationCsv(controller.signal);
        const parsed = parseCsvRow(csv);
        if (!parsed) throw new Error('Failed to parse ECB HICP CSV');

        if (cancelled) return;
        const result: InflationData = {
          currentRate: parsed.rate,
          period: parsed.period,
          source: 'Eurostat',
          isStale: isStaleData(parsed.period),
        };
        setData(result);
      } catch (err) {
        if (cancelled) return;

        // Fallback to NBP target
        const fallback: InflationData = {
          currentRate: NBP_TARGET_RATE,
          period: '',
          source: 'cel NBP (fallback)',
        };
        setData(fallback);
        setError(err instanceof Error ? err.message : 'Błąd pobierania HICP');
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
