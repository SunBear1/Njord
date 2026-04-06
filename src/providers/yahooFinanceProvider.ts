import type { AssetData, HistoricalPrice } from '../types/asset';

const YF_CHART_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';

// Yahoo Finance v8 does NOT send CORS headers. Browser direct fetch always fails.
// We race multiple free CORS proxies — whichever responds first with valid JSON wins.
// Free proxies are inherently unreliable, so racing is the only robust approach.
const CORS_PROXY_FACTORIES: Array<(url: string) => string> = [
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

async function fetchViaProxy(
  proxyUrl: string,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const signals = outerSignal
    ? [outerSignal, controller.signal]
    : [controller.signal];

  // AbortSignal.any may not exist in older browsers — polyfill-safe fallback
  let combinedSignal: AbortSignal;
  if (typeof AbortSignal.any === 'function') {
    combinedSignal = AbortSignal.any(signals);
  } else {
    combinedSignal = controller.signal;
    outerSignal?.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(proxyUrl, { signal: combinedSignal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Validate we got JSON, not an error page
    const text = await res.text();
    if (!text.startsWith('{')) throw new Error('Non-JSON response');
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchYahoo(chartUrl: string, signal?: AbortSignal): Promise<Response> {
  // Race all proxies — first one with valid JSON wins
  const promises = CORS_PROXY_FACTORIES.map((makeUrl) =>
    fetchViaProxy(makeUrl(chartUrl), 10_000, signal),
  );

  try {
    return await Promise.any(promises);
  } catch {
    throw new Error(
      'Nie udało się pobrać danych giełdowych. Serwery proxy mogą być chwilowo niedostępne — spróbuj ponownie za chwilę lub wpisz cenę ręcznie.',
    );
  }
}

export async function fetchAssetData(ticker: string, signal?: AbortSignal): Promise<AssetData> {
  const chartUrl = `${YF_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
  const res = await fetchYahoo(chartUrl, signal);
  const data = await res.json();

  if (!data.chart?.result?.[0]) {
    throw new Error(`Nie znaleziono tickera: ${ticker}`);
  }

  const result = data.chart.result[0];
  const meta = result.meta;

  if (meta.regularMarketPrice == null) {
    throw new Error(`Brak ceny rynkowej dla ${ticker}`);
  }

  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const historicalPrices: HistoricalPrice[] = timestamps
    .map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: closes[i],
    }))
    .filter((p: HistoricalPrice) => p.close != null && !isNaN(p.close));

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
