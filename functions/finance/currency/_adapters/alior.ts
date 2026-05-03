import type { CurrencyRate } from '../_shared/types';

const ALIOR_BASE = 'https://klient.internetowykantor.pl/api/public/marketBrief';
const TIMEOUT_MS = 5_000;
const PAIRS = ['USD_PLN', 'EUR_PLN', 'GBP_PLN'] as const;

interface AliorResponse {
  pair: string;
  ts: string;
  directExchangeOffers: {
    buyNow: number;
    sellNow: number;
    forexNow: number;
  };
}

export async function fetchAliorRates(): Promise<CurrencyRate[]> {
  const results: CurrencyRate[] = [];

  const responses = await Promise.allSettled(
    PAIRS.map((pair) =>
      fetch(`${ALIOR_BASE}/${pair}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Njord/1.0' },
      }),
    ),
  );

  for (let i = 0; i < PAIRS.length; i++) {
    const res = responses[i];
    if (res.status !== 'fulfilled' || !res.value.ok) continue;

    const data = (await res.value.json()) as AliorResponse;
    const { buyNow, sellNow, forexNow } = data.directExchangeOffers;

    results.push({
      source: 'alior',
      pair: PAIRS[i].replace('_', '/'),
      bid: buyNow,
      ask: sellNow,
      mid: forexNow,
      timestamp: data.ts,
    });
  }

  return results;
}
