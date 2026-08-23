import type { CurrencyRate } from '../../_shared/types';

const WALUTOMAT_BASE = 'https://user.walutomat.pl/api/public/marketBrief';
const TIMEOUT_MS = 5_000;
const PAIRS = ['USD_PLN', 'EUR_PLN', 'GBP_PLN'] as const;

interface WalutomatResponse {
  pair: string;
  bestOffers: {
    bid_now: number;
    ask_now: number;
    forex_now: number;
  };
  lastExchanges?: Array<{ ts: string }>;
}

export async function fetchWalutomatRates(): Promise<CurrencyRate[]> {
  const results: CurrencyRate[] = [];

  const responses = await Promise.allSettled(
    PAIRS.map((pair) =>
      fetch(`${WALUTOMAT_BASE}/${pair}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Njord/1.0' },
      }),
    ),
  );

  for (let i = 0; i < PAIRS.length; i++) {
    const res = responses[i];
    if (res.status !== 'fulfilled' || !res.value.ok) continue;

    try {
      const data = (await res.value.json()) as WalutomatResponse;
      const { bid_now, ask_now, forex_now } = data.bestOffers;

      results.push({
        source: 'walutomat',
        pair: PAIRS[i].replace('_', '/'),
        bid: bid_now,
        ask: ask_now,
        mid: forex_now,
        timestamp: data.lastExchanges?.[0]?.ts ?? new Date().toISOString(),
      });
    } catch {
      // skip this pair if parsing fails
    }
  }

  return results;
}
