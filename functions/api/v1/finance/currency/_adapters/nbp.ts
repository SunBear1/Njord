import type { CurrencyRate } from '../../_shared/types';

const NBP_TABLE_C_BASE = 'https://api.nbp.pl/api/exchangerates/rates/C';
const NBP_TABLE_A_BASE = 'https://api.nbp.pl/api/exchangerates/rates/a';
const TIMEOUT_MS = 5_000;
const HISTORY_TIMEOUT_MS = 8_000;
const PAIRS = ['USD', 'EUR', 'GBP'] as const;

// ─── Table A: single-date mid rate (last business day before `date`) ─────────

export interface NbpTableAResult {
  rate: number;
  effectiveDate: string;
}

/**
 * Fetches the NBP Table A mid rate for `currency` as of the last business day
 * strictly before `date` (YYYY-MM-DD).
 *
 * For PLN returns rate = 1 without making an API call.
 */
export async function fetchNbpTableARate(
  date: string,
  currency: string,
): Promise<NbpTableAResult> {
  if (currency.toUpperCase() === 'PLN') {
    return { rate: 1, effectiveDate: date };
  }

  const transactionDate = new Date(date);
  if (isNaN(transactionDate.getTime())) {
    throw new Error('Invalid date format');
  }

  // Query a 7-day window ending the day before `date` to find the last business day rate.
  const endDate = subtractDays(transactionDate, 1);
  const startDate = subtractDays(transactionDate, 7);

  const url =
    `${NBP_TABLE_A_BASE}/${currency.toLowerCase()}/${formatDate(startDate)}/${formatDate(endDate)}/?format=json`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'Njord/1.0' },
  });

  if (res.status === 404) {
    throw new Error(`No NBP rate for ${currency.toUpperCase()} near date ${date}`);
  }

  if (!res.ok) {
    throw new Error(`NBP upstream error (HTTP ${res.status})`);
  }

  interface NbpAResponse {
    rates: Array<{ mid: number; effectiveDate: string }>;
  }

  const data = (await res.json()) as NbpAResponse;

  if (!data?.rates?.length) {
    throw new Error(`No NBP rates returned for ${currency.toUpperCase()} in this period`);
  }

  // Filter to rates strictly before `date`, then take the last one.
  const eligible = data.rates.filter((r) => r.effectiveDate < date);
  if (eligible.length === 0) {
    throw new Error(`No NBP rate before ${date} for ${currency.toUpperCase()}`);
  }

  const last = eligible[eligible.length - 1];
  return { rate: last.mid, effectiveDate: last.effectiveDate };
}

// ─── Table A: historical rates (last N days) ─────────────────────────────────

export interface NbpHistoricalRate {
  date: string; // YYYY-MM-DD
  mid: number; // Table A mid rate
}

export async function fetchNbpFxHistory(
  currency: string,
  days: number,
): Promise<NbpHistoricalRate[]> {
  try {
    const res = await fetch(
      `${NBP_TABLE_A_BASE}/${currency}/last/${days}/?format=json`,
      {
        signal: AbortSignal.timeout(HISTORY_TIMEOUT_MS),
        headers: { 'User-Agent': 'Njord/1.0' },
      },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      table: string;
      currency: string;
      code: string;
      rates: Array<{ no: string; effectiveDate: string; mid: number }>;
    };

    return data.rates.map((r) => ({
      date: r.effectiveDate,
      mid: r.mid,
    }));
  } catch {
    return [];
  }
}

// ─── Table C: buy/sell rates ─────────────────────────────────────────────────

export async function fetchNbpRates(): Promise<CurrencyRate[]> {
  const results: CurrencyRate[] = [];

  const responses = await Promise.allSettled(
    PAIRS.map((code) =>
      fetch(`${NBP_TABLE_C_BASE}/${code}/?format=json`, {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
