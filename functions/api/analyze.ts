/**
 * Pages Function: GET /api/analyze?ticker=AAPL
 *
 * Thin proxy that fetches stock data from Twelve Data and FX rates from NBP.
 * The Twelve Data API key is kept secret in the CF Pages environment — never
 * exposed to the browser.  All heavy computation (GBM, Bootstrap) runs
 * client-side where there is no CPU time limit.
 *
 * Response is cached at the CF edge for 1 hour per ticker.
 */

import type { HistoricalPrice } from '../../src/types/asset';
import type { FxRate } from '../../src/providers/nbpProvider';
import type { ProxyResponse } from '../../src/types/analyze';

interface Env {
  TWELVE_DATA_API_KEY: string;
}

// ── Twelve Data ────────────────────────────────────────────────────────────────

interface TwelveDataMeta {
  symbol: string;
  currency: string;
  exchange: string;
  type: string;
}

async function fetchStockData(
  ticker: string,
  apiKey: string,
): Promise<{ meta: TwelveDataMeta; historicalPrices: HistoricalPrice[]; currentPrice: number }> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=504&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as {
    code?: number;
    status?: string;
    message?: string;
    meta?: TwelveDataMeta;
    values?: Array<{ datetime: string; close: string }>;
  };

  if (data.code === 401) throw new Error('Nieprawidłowy klucz API Twelve Data.');
  if (data.code === 429) throw new Error('RATE_LIMIT');
  if (data.status === 'error') throw new Error(data.message || `Nie znaleziono tickera: ${ticker}`);
  if (!data.meta || !data.values?.length) throw new Error(`Nie znaleziono danych dla: ${ticker}`);

  const values = data.values;
  const currentPrice = parseFloat(values[0].close);
  if (isNaN(currentPrice)) throw new Error(`Brak ceny rynkowej dla ${ticker}`);

  const historicalPrices: HistoricalPrice[] = values
    .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
    .filter((p) => !isNaN(p.close))
    .reverse();

  return { meta: data.meta, historicalPrices, currentPrice };
}

// ── NBP FX ─────────────────────────────────────────────────────────────────────

const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/A';

async function fetchFxData(currency = 'USD'): Promise<{ currentRate: number; historicalRates: FxRate[] }> {
  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [currentRes, hist1Res, hist2Res] = await Promise.all([
    fetch(`${NBP_BASE}/${currency}/?format=json`),
    fetch(`${NBP_BASE}/${currency}/${fmt(twoYearsAgo)}/${fmt(oneYearAgo)}/?format=json`),
    fetch(`${NBP_BASE}/${currency}/${fmt(oneYearAgo)}/${fmt(now)}/?format=json`),
  ]);

  if (!currentRes.ok) throw new Error('Błąd pobierania kursu USD/PLN z NBP');

  const parseRates = async (r: Response): Promise<FxRate[]> => {
    if (!r.ok) return [];
    const d = await r.json() as { rates?: Array<{ effectiveDate: string; mid: number }> };
    return (d.rates ?? []).map((x) => ({ date: x.effectiveDate, rate: x.mid }));
  };

  const currentData = await currentRes.json() as { rates?: Array<{ mid: number }> };
  if (!currentData.rates?.length) throw new Error('NBP nie zwrócił bieżącego kursu');

  const [hist1, hist2] = await Promise.all([parseRates(hist1Res), parseRates(hist2Res)]);

  return {
    currentRate: currentData.rates[0].mid,
    historicalRates: [...hist1, ...hist2],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();

  if (!ticker) {
    return new Response(JSON.stringify({ error: 'Brak parametru ticker' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!env.TWELVE_DATA_API_KEY) {
    return new Response(JSON.stringify({ error: 'Server configuration error: API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const [stockResult, fxResult] = await Promise.all([
      fetchStockData(ticker, env.TWELVE_DATA_API_KEY),
      fetchFxData(),
    ]);

    const { meta, historicalPrices, currentPrice } = stockResult;
    const { currentRate, historicalRates } = fxResult;

    let assetType: 'stock' | 'etf' | 'commodity' | 'crypto' = 'stock';
    const type = (meta.type || '').toLowerCase();
    if (type.includes('etf')) assetType = 'etf';
    else if (type.includes('crypto') || type.includes('digital')) assetType = 'crypto';
    else if (type.includes('commodity') || type.includes('future')) assetType = 'commodity';

    const response: ProxyResponse = {
      assetData: {
        asset: {
          ticker: meta.symbol,
          name: meta.symbol,
          type: assetType,
          currency: meta.currency || 'USD',
          currentPrice,
        },
        historicalPrices,
      },
      fxData: {
        currentRate,
        historicalRates,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nieznany błąd';
    const isRateLimit = message === 'RATE_LIMIT';
    return new Response(JSON.stringify({ error: message }), {
      status: isRateLimit ? 429 : 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};
