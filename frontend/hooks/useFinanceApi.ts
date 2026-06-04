/**
 * React Query hooks for the new /api/v1/finance/* API endpoints.
 *
 * Each hook wraps useQuery with appropriate caching (staleTime) based on
 * how frequently the underlying data changes.
 */

import { useQuery } from '@tanstack/react-query';
import type {
  Bond,
  CurrencyRate,
  InflationDataPoint,
  InflationForecast,
  StockBar,
  StockSearchResult,
  ApiResponse,
} from '../types/financeApi';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function fetchApi<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((error as { error: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

export function useStockData(ticker: string, interval = '1d', range = '1mo') {
  return useQuery({
    queryKey: ['finance', 'stocks', ticker, interval, range],
    queryFn: () =>
      fetchApi<StockBar[]>(
        `/api/v1/finance/stocks/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
      ),
    staleTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!ticker,
  });
}

export function useCurrencyRates(pairs?: string, source?: string) {
  const params = new URLSearchParams();
  if (pairs) params.set('pairs', pairs);
  if (source) params.set('source', source);
  const qs = params.toString();

  return useQuery({
    queryKey: ['finance', 'currency', pairs, source],
    queryFn: () => fetchApi<CurrencyRate[]>(`/api/v1/finance/currency${qs ? `?${qs}` : ''}`),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 10 * 1000,
  });
}

export function useBonds(type?: string, isFamily?: boolean) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (isFamily !== undefined) params.set('is_family', String(isFamily));
  const qs = params.toString();

  return useQuery({
    queryKey: ['finance', 'bonds', type, isFamily],
    queryFn: () => fetchApi<Bond[]>(`/api/v1/finance/bonds${qs ? `?${qs}` : ''}`),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useInflation(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  return useQuery({
    queryKey: ['finance', 'inflation', from, to],
    queryFn: () => fetchApi<InflationDataPoint[]>(`/api/v1/finance/inflation${qs ? `?${qs}` : ''}`),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useInflationForecast(report?: string) {
  const params = new URLSearchParams();
  if (report) params.set('report', report);
  const qs = params.toString();

  return useQuery({
    queryKey: ['finance', 'inflation-forecast', report],
    queryFn: () =>
      fetchApi<InflationForecast[]>(`/api/v1/finance/inflation/forecast${qs ? `?${qs}` : ''}`),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: ['finance', 'stocks-search', query],
    queryFn: () =>
      fetchApi<StockSearchResult[]>(
        `/api/v1/finance/stocks/search?q=${encodeURIComponent(query)}`,
      ),
    staleTime: 60 * 1000, // 1 minute
    enabled: query.length >= 1,
  });
}
