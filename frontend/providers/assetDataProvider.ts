import type { AssetData, AssetType, HistoricalPrice } from '../types/asset';
import type { FxRate } from './nbpProvider';
import type { ProxyResponse } from '../types/marketData';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface CurrencyHistoryResponse {
  ok: boolean;
  data?: {
    currency: string;
    rates: Array<{
      date: string;
      mid: number;
    }>;
  };
}

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
  try {
    const response = await fetch('/api/v1/finance/currency/history?currency=USD&days=90', { signal });
    if (!response.ok) {
      return { currentRate: 0, historicalRates: [] };
    }

    const json = await response.json() as CurrencyHistoryResponse;
    if (!json.ok || !json.data?.rates?.length) {
      return { currentRate: 0, historicalRates: [] };
    }

    const historicalRates = json.data.rates
      .filter((rate) => typeof rate.mid === 'number' && isFinite(rate.mid) && rate.mid > 0)
      .map((rate) => ({ date: rate.date, rate: rate.mid }));

    const currentRate = historicalRates[historicalRates.length - 1]?.rate ?? 0;
    return { currentRate, historicalRates };
  } catch {
    return { currentRate: 0, historicalRates: [] };
  }
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
