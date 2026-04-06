export interface FxRate {
  date: string;
  rate: number;
}

export interface FxData {
  currentRate: number;
  historicalRates: FxRate[];
}

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/A';

function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchFxData(currency = 'USD'): Promise<FxData> {
  const [currentRes, histRes] = await Promise.all([
    fetchWithTimeout(`${NBP_BASE}/${currency}/?format=json`),
    fetchWithTimeout(`${NBP_BASE}/${currency}/last/90/?format=json`),
  ]);

  if (!currentRes.ok || !histRes.ok) {
    throw new Error('Błąd pobierania kursu USD/PLN z NBP');
  }

  const currentData = await currentRes.json();
  const histData = await histRes.json();

  if (!currentData.rates?.length) {
    throw new Error('NBP nie zwrócił bieżącego kursu');
  }

  const currentRate: number = currentData.rates[0].mid;
  const historicalRates: FxRate[] = (histData.rates ?? []).map(
    (r: { effectiveDate: string; mid: number }) => ({
      date: r.effectiveDate,
      rate: r.mid,
    }),
  );

  return { currentRate, historicalRates };
}
