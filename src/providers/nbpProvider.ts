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
  // NBP API limits to 367 days per request — split 2-year range into 2 chunks
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [currentRes, hist1Res, hist2Res] = await Promise.all([
    fetchWithTimeout(`${NBP_BASE}/${currency}/?format=json`),
    fetchWithTimeout(`${NBP_BASE}/${currency}/${fmt(twoYearsAgo)}/${fmt(oneYearAgo)}/?format=json`),
    fetchWithTimeout(`${NBP_BASE}/${currency}/${fmt(oneYearAgo)}/${fmt(now)}/?format=json`),
  ]);

  if (!currentRes.ok) {
    throw new Error('Błąd pobierania kursu USD/PLN z NBP');
  }

  const currentData = await currentRes.json();
  if (!currentData.rates?.length) {
    throw new Error('NBP nie zwrócił bieżącego kursu');
  }

  const parseRates = (data: { rates?: Array<{ effectiveDate: string; mid: number }> }): FxRate[] =>
    (data.rates ?? []).map((r) => ({ date: r.effectiveDate, rate: r.mid }));

  // Merge both year-chunks; either may fail (e.g. new currency), so handle gracefully
  const hist1 = hist1Res.ok ? parseRates(await hist1Res.json()) : [];
  const hist2 = hist2Res.ok ? parseRates(await hist2Res.json()) : [];
  const historicalRates = [...hist1, ...hist2];

  const currentRate: number = currentData.rates[0].mid;
  return { currentRate, historicalRates };
}
