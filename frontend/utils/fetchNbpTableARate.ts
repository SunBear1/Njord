export interface NbpRateResult {
  /** Mid rate from NBP Table A. */
  rate: number;
  /** Actual date the rate corresponds to (last business day before `date`). */
  effectiveDate: string;
}

interface CurrencyRateResponse {
  ok: boolean;
  data?: {
    rate: number;
    effectiveDate: string;
  };
  error?: string;
}

export async function fetchNbpTableARate(
  date: string,
  currency = 'USD',
  signal?: AbortSignal,
): Promise<NbpRateResult> {
  if (!date) throw new Error('Brak daty transakcji.');

  if (currency.toUpperCase() === 'PLN') {
    return { rate: 1, effectiveDate: date };
  }

  const transactionDate = new Date(date);
  if (isNaN(transactionDate.getTime())) {
    throw new Error('Nieprawidłowy format daty.');
  }

  const url = `/api/v1/finance/currency/rate?date=${encodeURIComponent(date)}&currency=${encodeURIComponent(currency.toUpperCase())}`;

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new Error('Błąd sieci — sprawdź połączenie z internetem.');
  }

  let json: CurrencyRateResponse;
  try {
    json = (await res.json()) as CurrencyRateResponse;
  } catch {
    throw new Error('Błąd odpowiedzi serwera kursów walut. Spróbuj ponownie.');
  }

  if (!res.ok) {
    throw new Error(json.error || `Błąd pobierania kursu waluty (HTTP ${res.status}).`);
  }

  if (!json.ok || !json.data) {
    throw new Error(json.error || `Nie udało się pobrać kursu ${currency.toUpperCase()} dla daty ${date}.`);
  }

  if (
    typeof json.data.rate !== 'number' ||
    !isFinite(json.data.rate) ||
    json.data.rate <= 0 ||
    !json.data.effectiveDate
  ) {
    throw new Error('Serwer zwrócił nieprawidłowy kurs waluty.');
  }

  return {
    rate: json.data.rate,
    effectiveDate: json.data.effectiveDate,
  };
}
