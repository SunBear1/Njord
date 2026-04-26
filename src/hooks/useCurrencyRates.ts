import { useState, useEffect } from 'react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
export interface CurrencyRates {
  alior: { buy: number; sell: number; mid: number; ts: string } | null;
  nbp: { buy: number; sell: number; mid: number; date: string } | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const ALIOR_URL = 'https://klient.internetowykantor.pl/api/public/marketBrief/USD_PLN';
const NBP_URL = 'https://api.nbp.pl/api/exchangerates/rates/C/USD/?format=json';

interface AliorResponse {
  pair: string;
  ts: string;
  directExchangeOffers: {
    forexNow: number;
    sellNow: number;
    buyNow: number;
  };
}

interface NbpResponse {
  rates: Array<{ bid: number; ask: number; effectiveDate: string }>;
}

interface ProxyResponse {
  alior: CurrencyRates['alior'];
  nbp: CurrencyRates['nbp'];
}

async function fetchViaProxy(): Promise<ProxyResponse> {
  const res = await fetchWithTimeout('/api/currency-rates');
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  return await res.json() as ProxyResponse;
}

async function fetchAliorDirect(): Promise<CurrencyRates['alior']> {
  const res = await fetchWithTimeout(ALIOR_URL);
  if (!res.ok) return null;
  const data: AliorResponse = await res.json();
  const { buyNow, sellNow, forexNow } = data.directExchangeOffers;
  return { buy: buyNow, sell: sellNow, mid: forexNow, ts: data.ts };
}

async function fetchNbpDirect(): Promise<CurrencyRates['nbp']> {
  const res = await fetchWithTimeout(NBP_URL);
  if (!res.ok) return null;
  const data: NbpResponse = await res.json();
  const rate = data.rates[0];
  if (!rate) return null;
  return { buy: rate.bid, sell: rate.ask, mid: (rate.bid + rate.ask) / 2, date: rate.effectiveDate };
}

/**
 * Fetches USD/PLN buy/sell rates from Alior Kantor and NBP Table C.
 * Tries the /api/currency-rates proxy first (edge-cached), falls back to direct API calls.
 * Auto-refreshes every 60 seconds.
 */
export function useCurrencyRates(): CurrencyRates {
  const [alior, setAlior] = useState<CurrencyRates['alior']>(null);
  const [nbp, setNbp] = useState<CurrencyRates['nbp']>(null);
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
        // Try proxy first (edge-cached)
        const proxy = await fetchViaProxy();
        if (cancelled) return;
        setAlior(proxy.alior);
        setNbp(proxy.nbp);
        setLastUpdated(new Date());
      } catch {
        // Fallback to direct API calls
        try {
          const [a, n] = await Promise.allSettled([fetchAliorDirect(), fetchNbpDirect()]);
          if (cancelled) return;
          setAlior(a.status === 'fulfilled' ? a.value : null);
          setNbp(n.status === 'fulfilled' ? n.value : null);
          if (a.status === 'rejected' && n.status === 'rejected') {
            setError('Nie udało się pobrać kursów walut.');
          } else {
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

  return { alior, nbp, isLoading, error, lastUpdated };
}
