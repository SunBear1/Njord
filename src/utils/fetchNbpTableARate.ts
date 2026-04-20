/**
 * Fetches the NBP Table A (average) exchange rate for a given currency,
 * using the last business day BEFORE the provided date.
 *
 * Per Polish tax law: to convert USD gains/costs to PLN, use the NBP mid rate
 * from the last business day preceding the transaction date.
 */

import { fetchWithTimeout } from './fetchWithTimeout';

export interface NbpRateResult {
  /** Mid rate from NBP Table A. */
  rate: number;
  /** Actual date the rate corresponds to (last business day before `date`). */
  effectiveDate: string;
}

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/a';
const NBP_TIMEOUT_MS = 8_000;

/**
 * Returns the NBP Table A mid rate for `currency` as of the last business day
 * strictly before `date` (YYYY-MM-DD).
 *
 * For PLN, returns rate = 1 without making an API call.
 * Throws a Polish-language error string on failure.
 *
 * @param signal - Optional AbortSignal to cancel the request (e.g. when the
 *   user changes the date before the previous fetch resolves).
 */
export async function fetchNbpTableARate(
  date: string,
  currency = 'USD',
  signal?: AbortSignal,
): Promise<NbpRateResult> {
  if (!date) throw new Error('Brak daty transakcji.');

  // PLN → no conversion needed
  if (currency.toUpperCase() === 'PLN') {
    return { rate: 1, effectiveDate: date };
  }

  const transactionDate = new Date(date);
  if (isNaN(transactionDate.getTime())) {
    throw new Error('Nieprawidłowy format daty.');
  }

  // Query a 14-day window ending the day before the transaction date.
  // The last entry in the result is the most recent business day before `date`.
  const endDate = subtractDays(transactionDate, 1);
  const startDate = subtractDays(transactionDate, 14);

  const url =
    `${NBP_BASE}/${currency.toLowerCase()}/${formatDate(startDate)}/${formatDate(endDate)}/?format=json`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, signal, NBP_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error('Błąd sieci — sprawdź połączenie z internetem.');
  }

  if (res.status === 404) {
    throw new Error(
      `Brak kursu NBP dla waluty ${currency.toUpperCase()} w okolicach daty ${date}. ` +
        'Wprowadź kurs ręcznie.',
    );
  }

  if (!res.ok) {
    throw new Error(`Błąd NBP (HTTP ${res.status}). Wprowadź kurs ręcznie.`);
  }

  interface NbpResponse {
    rates: Array<{ mid: number; effectiveDate: string }>;
  }

  const data = (await res.json()) as NbpResponse;

  if (!data?.rates?.length) {
    throw new Error(
      `NBP nie zwróciło kursów dla ${currency.toUpperCase()} w tym okresie. Wprowadź kurs ręcznie.`,
    );
  }

  // Last entry = most recent business day before the transaction date.
  const last = data.rates[data.rates.length - 1];
  if (typeof last.mid !== 'number' || !isFinite(last.mid) || last.mid <= 0) {
    throw new Error('NBP zwróciło nieprawidłowy kurs. Wprowadź kurs ręcznie.');
  }
  return { rate: last.mid, effectiveDate: last.effectiveDate };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
