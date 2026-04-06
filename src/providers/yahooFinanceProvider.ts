import type { AssetData, HistoricalPrice } from '../types/asset';

const YF_BASE = 'https://query1.finance.yahoo.com';

async function fetchWithCors(url: string): Promise<Response> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch {
    // Fallback to CORS proxy
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    return res;
  }
}

export async function fetchAssetData(ticker: string): Promise<AssetData> {
  const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
  const res = await fetchWithCors(url);
  const data = await res.json();

  if (!data.chart?.result?.[0]) {
    throw new Error(`Nie znaleziono danych dla tickera: ${ticker}`);
  }

  const result = data.chart.result[0];
  const meta = result.meta;
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const historicalPrices: HistoricalPrice[] = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i],
    }))
    .filter((p) => p.close != null && !isNaN(p.close));

  let assetType: 'stock' | 'etf' | 'commodity' | 'crypto' = 'stock';
  if (meta.instrumentType === 'ETF') assetType = 'etf';
  else if (meta.instrumentType === 'CRYPTOCURRENCY') assetType = 'crypto';
  else if (meta.instrumentType === 'FUTURE' || meta.instrumentType === 'COMMODITY') assetType = 'commodity';

  return {
    asset: {
      ticker: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      type: assetType,
      currency: meta.currency,
      currentPrice: meta.regularMarketPrice,
    },
    historicalPrices,
  };
}
