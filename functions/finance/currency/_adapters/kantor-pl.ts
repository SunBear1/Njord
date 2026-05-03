import type { CurrencyRate } from '../_shared/types';

const KANTOR_URL = 'https://banker.kantor.pl/ajax';
const TIMEOUT_MS = 5_000;

interface KantorResponse {
  data: Array<{
    symbol: string;
    buy: string;
    sell: string;
    date: string;
  }>;
}

export async function fetchKantorPlRates(): Promise<CurrencyRate[]> {
  try {
    const res = await fetch(KANTOR_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Njord/1.0' },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as KantorResponse;
    const wanted = new Set(['USD/PLN', 'EUR/PLN', 'GBP/PLN']);

    return data.data
      .filter((item) => wanted.has(item.symbol))
      .map((item) => ({
        source: 'kantor_pl',
        pair: item.symbol,
        bid: parseFloat(item.buy),
        ask: parseFloat(item.sell),
        mid: (parseFloat(item.buy) + parseFloat(item.sell)) / 2,
        timestamp: item.date,
      }));
  } catch {
    return [];
  }
}
