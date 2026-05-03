import { useState, useEffect } from 'react';
import type { ApiResponse, CurrencyRate } from '../types/financeApi';

export interface CurrencyRates {
  alior: { buy: number; sell: number; mid: number; ts: string } | null;
  nbp: { buy: number; sell: number; mid: number; date: string } | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

async function fetchViaProxy(): Promise<Pick<CurrencyRates, 'alior' | 'nbp'>> {
  const res = await fetch('/api/v1/finance/currency?pairs=USD/PLN', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);

  const rates = ((await res.json()) as ApiResponse<CurrencyRate[]>).data;
  const aliorRate = rates.find((rate) => rate.source === 'alior' && rate.pair === 'USD/PLN');
  const nbpRate = rates.find((rate) => rate.source === 'nbp' && rate.pair === 'USD/PLN');

  return {
    alior: aliorRate
      ? {
          buy: aliorRate.bid,
          sell: aliorRate.ask,
          mid: aliorRate.mid ?? (aliorRate.bid + aliorRate.ask) / 2,
          ts: aliorRate.timestamp,
        }
      : null,
    nbp: nbpRate
      ? {
          buy: nbpRate.bid,
          sell: nbpRate.ask,
          mid: nbpRate.mid ?? (nbpRate.bid + nbpRate.ask) / 2,
          date: nbpRate.timestamp.slice(0, 10),
        }
      : null,
  };
}

/**
 * Fetches USD/PLN buy/sell rates from Alior Kantor and NBP Table C via the
 * /api/v1/finance/currency proxy. Auto-refreshes every 60 seconds.
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
