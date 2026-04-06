import type { AssetData, HistoricalPrice } from '../types/asset';

const BASE_URL = 'https://api.twelvedata.com';

export async function fetchAssetData(
  ticker: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<AssetData> {
  const url = `${BASE_URL}/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=90&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  if (data.code === 401) {
    throw new Error('Nieprawidłowy klucz API. Sprawdź swój klucz Twelve Data.');
  }

  if (data.code === 429) {
    throw new Error('Przekroczono limit zapytań API. Spróbuj ponownie za chwilę.');
  }

  if (data.status === 'error') {
    throw new Error(data.message || `Nie znaleziono tickera: ${ticker}`);
  }

  if (!data.meta || !data.values?.length) {
    throw new Error(`Nie znaleziono danych dla: ${ticker}`);
  }

  const meta = data.meta;
  const values: Array<{ datetime: string; close: string }> = data.values;

  const currentPrice = parseFloat(values[0].close);
  if (isNaN(currentPrice)) {
    throw new Error(`Brak ceny rynkowej dla ${ticker}`);
  }

  // values come newest-first from Twelve Data — reverse for chronological order
  const historicalPrices: HistoricalPrice[] = values
    .map((v) => ({
      date: v.datetime,
      close: parseFloat(v.close),
    }))
    .filter((p) => !isNaN(p.close))
    .reverse();

  let assetType: 'stock' | 'etf' | 'commodity' | 'crypto' = 'stock';
  const type = (meta.type || '').toLowerCase();
  if (type.includes('etf')) assetType = 'etf';
  else if (type.includes('crypto') || type.includes('digital')) assetType = 'crypto';
  else if (type.includes('commodity') || type.includes('future')) assetType = 'commodity';

  return {
    asset: {
      ticker: meta.symbol,
      name: meta.symbol, // Twelve Data /time_series doesn't return long name
      type: assetType,
      currency: meta.currency || 'USD',
      currentPrice,
    },
    historicalPrices,
  };
}
