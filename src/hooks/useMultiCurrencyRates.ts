import { useState, useEffect } from 'react';
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

export interface MultiCurrencyRates {
  rates: CurrencyRateEntry[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

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

export function useMultiCurrencyRates(): MultiCurrencyRates {
  const [rates, setRates] = useState<CurrencyRateEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchViaProxy();
        if (cancelled) return;
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
    const interval = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { rates, isLoading, error, lastUpdated };
}
