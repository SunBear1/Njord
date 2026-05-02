import { useState, useEffect } from 'react';

export interface CurrencyRates {
  alior: { buy: number; sell: number; mid: number; ts: string } | null;
  nbp: { buy: number; sell: number; mid: number; date: string } | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface ProxyResponse {
  alior: CurrencyRates['alior'];
  nbp: CurrencyRates['nbp'];
}

async function fetchViaProxy(): Promise<ProxyResponse> {
  const res = await fetch('/api/currency-rates', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  return await res.json() as ProxyResponse;
}

/**
 * Fetches USD/PLN buy/sell rates from Alior Kantor and NBP Table C via the
 * /api/currency-rates proxy. Auto-refreshes every 60 seconds.
 * Used by ComparisonPage and TaxPage for FX rate display (not the live ticker).
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
        const proxy = await fetchViaProxy();
        if (cancelled) return;
        setAlior(proxy.alior);
        setNbp(proxy.nbp);
        setLastUpdated(new Date());
      } catch {
        if (!cancelled) setError('Nie udało się pobrać kursów walut.');
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
