import type { AssetData, AssetType, HistoricalPrice } from '../types/asset';
import type { FxRate } from './nbpProvider';
import type { ProxyResponse } from '../types/marketData';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface StockBar {
  timestamp: number;
  close: number;
}

interface StockBarsApiResponse {
  data: StockBar[];
  _meta: {
    source: string;
    currency?: string;
    currentPrice?: number;
    name?: string;
    type?: string;
  };
}

function translateError(message: string, ticker?: string): string {
  if (message.includes('NOT_FOUND') || message.includes('404')) return `Nie znaleziono tickera: ${ticker ?? ''}`;
  if (message.includes('429') || message.includes('RATE_LIMITED')) return 'Przekroczono limit zapytań API. Spróbuj ponownie za minutę.';
  return message;
}

async function fetchNbpFxHistory(signal?: AbortSignal): Promise<{ currentRate: number; historicalRates: FxRate[] }> {
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(now.getFullYear() - 2);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const NBP = 'https://api.nbp.pl/api/exchangerates/rates/A/USD';

  const [currentRes, hist1Res, hist2Res] = await Promise.all([
    fetchWithTimeout(`${NBP}/?format=json`, signal),
    fetchWithTimeout(`${NBP}/${fmt(twoYearsAgo)}/${fmt(oneYearAgo)}/?format=json`, signal),
    fetchWithTimeout(`${NBP}/${fmt(oneYearAgo)}/${fmt(now)}/?format=json`, signal),
  ]);

  const parseRates = async (response: Response): Promise<FxRate[]> => {
    if (!response.ok) return [];
    const data = await response.json() as { rates?: Array<{ effectiveDate: string; mid: number }> };
    return (data.rates ?? []).map((rate) => ({ date: rate.effectiveDate, rate: rate.mid }));
  };

  if (!currentRes.ok) throw new Error('Błąd pobierania kursu USD/PLN z NBP');
  const currentData = await currentRes.json() as { rates?: Array<{ mid: number }> };
  if (!currentData.rates?.length) throw new Error('NBP zwróciło pusty kurs');

  const [hist1, hist2] = await Promise.all([parseRates(hist1Res), parseRates(hist2Res)]);
  return { currentRate: currentData.rates[0].mid, historicalRates: [...hist1, ...hist2] };
}

export async function fetchAssetData(ticker: string, signal?: AbortSignal): Promise<ProxyResponse> {
  const [barsRes, fxResult] = await Promise.all([
    fetchWithTimeout(`/api/v1/finance/stocks/${encodeURIComponent(ticker)}?range=2y&interval=1d`, signal),
    fetchNbpFxHistory(signal).catch(() => ({ currentRate: 0, historicalRates: [] as FxRate[] })),
  ]);

  if (!barsRes.ok) {
    const body = await barsRes.json().catch(() => ({})) as { error?: string; code?: string };
    throw new Error(translateError(body.code ?? body.error ?? `HTTP ${barsRes.status}`, ticker));
  }

  const barsData = await barsRes.json() as StockBarsApiResponse;

  const historicalPrices: HistoricalPrice[] = barsData.data.map((bar) => ({
    date: new Date(bar.timestamp * 1000).toISOString().slice(0, 10),
    close: bar.close,
  }));

  const meta = barsData._meta;
  const currentPrice = meta.currentPrice ?? (historicalPrices[historicalPrices.length - 1]?.close ?? 0);
  const rawType = (meta.type ?? 'stock').toLowerCase();
  const assetType: AssetType = rawType === 'etf' ? 'etf' : rawType === 'crypto' ? 'crypto' : 'stock';

  const assetData: AssetData = {
    asset: {
      ticker,
      name: meta.name ?? ticker,
      type: assetType,
      currency: meta.currency ?? 'USD',
      currentPrice,
    },
    historicalPrices,
  };

  return {
    assetData,
    fxData: fxResult,
  };
}
