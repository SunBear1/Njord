import { useState, useEffect, useRef } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

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

const REFRESH_INTERVAL_MS = 15_000;
const CURRENCIES = 'USD,EUR,GBP';
const ALIOR_BASE = 'https://klient.internetowykantor.pl/api/public/marketBrief';
const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/C';

interface AliorResponse {
  ts: string;
  directExchangeOffers: { forexNow: number; sellNow: number; buyNow: number };
}

interface NbpResponse {
  rates: Array<{ bid: number; ask: number; effectiveDate: string }>;
}

async function fetchViaProxy(): Promise<CurrencyRateEntry[]> {
  const res = await fetchWithTimeout(`/api/currency-rates?currencies=${CURRENCIES}`);
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  const data = await res.json() as { rates: CurrencyRateEntry[] };
  return data.rates;
}

async function fetchDirectForCurrency(currency: string): Promise<CurrencyRateEntry> {
  const [aliorRes, nbpRes] = await Promise.allSettled([
    fetchWithTimeout(`${ALIOR_BASE}/${currency}_PLN`).then(async r => {
      if (!r.ok) return null;
      const d: AliorResponse = await r.json();
      const { buyNow, sellNow, forexNow } = d.directExchangeOffers;
      return { buy: buyNow, sell: sellNow, mid: forexNow, ts: d.ts };
    }),
    fetchWithTimeout(`${NBP_BASE}/${currency}/?format=json`).then(async r => {
      if (!r.ok) return null;
      const d: NbpResponse = await r.json();
      const rate = d.rates[0];
      if (!rate) return null;
      return { buy: rate.bid, sell: rate.ask, mid: (rate.bid + rate.ask) / 2, date: rate.effectiveDate };
    }),
  ]);

  return {
    currency,
    alior: aliorRes.status === 'fulfilled' ? aliorRes.value : null,
    nbp: nbpRes.status === 'fulfilled' ? nbpRes.value : null,
  };
}

async function fetchDirectAll(): Promise<CurrencyRateEntry[]> {
  return Promise.all(CURRENCIES.split(',').map(fetchDirectForCurrency));
}

function direction(prev: number | undefined, curr: number): RateDirection {
  if (prev === undefined || prev === curr) return null;
  return curr > prev ? 'up' : 'down';
}

function computeChanges(
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

export function useMultiCurrencyRates(): MultiCurrencyRates {
  const [rates, setRates] = useState<CurrencyRateEntry[]>([]);
  const [changes, setChanges] = useState<Record<string, RateChangeInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevRatesRef = useRef<CurrencyRateEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchViaProxy();
        if (cancelled) return;
        setChanges(computeChanges(prevRatesRef.current, data));
        prevRatesRef.current = data;
        setRates(data);
        setLastUpdated(new Date());
      } catch {
        try {
          const data = await fetchDirectAll();
          if (cancelled) return;
          const hasAny = data.some(r => r.alior || r.nbp);
          if (!hasAny) {
            setError('Nie udało się pobrać kursów walut.');
          } else {
            setChanges(computeChanges(prevRatesRef.current, data));
            prevRatesRef.current = data;
            setRates(data);
            setLastUpdated(new Date());
          }
        } catch {
          if (!cancelled) setError('Błąd połączenia.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { rates, changes, isLoading, error, lastUpdated };
}
