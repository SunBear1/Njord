import type { CurrencyRate } from '../../_shared/types';

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/C';
const TIMEOUT_MS = 5_000;
const PAIRS = ['USD', 'EUR', 'GBP'] as const;

export async function fetchNbpRates(): Promise<CurrencyRate[]> {
  const results: CurrencyRate[] = [];

  const responses = await Promise.allSettled(
    PAIRS.map((code) =>
      fetch(`${NBP_BASE}/${code}/?format=json`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Njord/1.0' },
      }),
    ),
  );

  for (let i = 0; i < PAIRS.length; i++) {
    const res = responses[i];
    if (res.status !== 'fulfilled' || !res.value.ok) continue;

    const data = (await res.value.json()) as {
      rates: Array<{ bid: number; ask: number; effectiveDate: string }>;
    };
    const rate = data.rates[0];
    if (!rate) continue;

    results.push({
      source: 'nbp',
      pair: `${PAIRS[i]}/PLN`,
      bid: rate.bid,
      ask: rate.ask,
      mid: (rate.bid + rate.ask) / 2,
      timestamp: rate.effectiveDate,
    });
  }

  return results;
}
