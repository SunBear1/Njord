import { useState, useEffect, useRef } from 'react';

export interface RateData {
  buy: number;
  sell: number;
  mid: number;
}

export interface CurrencyRateEntry {
  currency: string;
  alior: (RateData & { ts: string }) | null;
  nbp: (RateData & { date: string }) | null;
}

/** Direction a rate moved since last refresh */
export type RateDirection = 'up' | 'down' | null;

export interface RateChangeInfo {
  aliorBuy: RateDirection;
  aliorSell: RateDirection;
  nbpBuy: RateDirection;
  nbpSell: RateDirection;
}

export interface MultiCurrencyRates {
  rates: CurrencyRateEntry[];
  changes: Record<string, RateChangeInfo>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const REFRESH_INTERVAL_MS = 1_000;
const CURRENCIES = 'USD,EUR,GBP';

interface ProxyResponse {
  rates: CurrencyRateEntry[];
  fetchedAt: number;
}

async function fetchViaProxy(signal: AbortSignal): Promise<CurrencyRateEntry[]> {
  const res = await fetch(`/api/currency-rates?currencies=${CURRENCIES}`, {
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  const data = await res.json() as ProxyResponse;
  return data.rates;
}

export function direction(prev: number | undefined, curr: number): RateDirection {
  if (prev === undefined || prev === curr) return null;
  return curr > prev ? 'up' : 'down';
}

export function computeChanges(
  prev: CurrencyRateEntry[],
  curr: CurrencyRateEntry[],
): Record<string, RateChangeInfo> {
  const result: Record<string, RateChangeInfo> = {};
  for (const entry of curr) {
    const old = prev.find(p => p.currency === entry.currency);
    result[entry.currency] = {
      aliorBuy: direction(old?.alior?.buy, entry.alior?.buy ?? 0),
      aliorSell: direction(old?.alior?.sell, entry.alior?.sell ?? 0),
      nbpBuy: direction(old?.nbp?.buy, entry.nbp?.buy ?? 0),
      nbpSell: direction(old?.nbp?.sell, entry.nbp?.sell ?? 0),
    };
  }
  return result;
}

/**
 * Returns true when any currency's Alior timestamp or NBP date has changed.
 * Used to skip React re-renders (and flash animations) when the API returns
 * identical data on consecutive polls.
 */
export function hasDataChanged(prev: CurrencyRateEntry[], curr: CurrencyRateEntry[]): boolean {
  if (prev.length !== curr.length) return true;
  for (let i = 0; i < curr.length; i++) {
    if (prev[i].currency !== curr[i].currency) return true;
    if (prev[i].alior?.ts !== curr[i].alior?.ts) return true;
    if (prev[i].nbp?.date !== curr[i].nbp?.date) return true;
  }
  return false;
}

export function useMultiCurrencyRates(): MultiCurrencyRates {
  const [rates, setRates] = useState<CurrencyRateEntry[]>([]);
  const [changes, setChanges] = useState<Record<string, RateChangeInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevRatesRef = useRef<CurrencyRateEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Cancel any in-flight request before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const data = await fetchViaProxy(controller.signal);
        if (!mounted || controller.signal.aborted) return;

        if (hasDataChanged(prevRatesRef.current, data)) {
          setChanges(computeChanges(prevRatesRef.current, data));
          prevRatesRef.current = data;
          setRates(data);
          setLastUpdated(new Date());
        }
        setError(null);
      } catch {
        if (!mounted || controller.signal.aborted) return;
        setError('Nie udało się pobrać kursów walut.');
      } finally {
        // Only clear initial loading spinner — subsequent polls are silent
        if (mounted && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    function onVisibilityChange() {
      if (!document.hidden) load();
    }

    load();
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intervalId = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      abortControllerRef.current?.abort();
    };
  }, []);

  return { rates, changes, isLoading, error, lastUpdated };
}
