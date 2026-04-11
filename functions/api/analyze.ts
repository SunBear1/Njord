/**
 * Pages Function: GET /api/analyze?ticker=AAPL
 *
 * Thin proxy that fetches stock/ETF data and FX rates from NBP.
 *
 * Data source strategy:
 *   Primary:  Yahoo Finance (no API key required)
 *   Fallback: Twelve Data — used only when Yahoo returns 429 (rate limited)
 *             and TWELVE_DATA_API_KEY is configured.
 *
 * TWELVE_DATA_API_KEY is optional. Without it the app works via Yahoo Finance
 * alone. Set it in .dev.vars (local) or CF Pages secrets (production) to enable
 * the fallback path.
 *
 * Response is cached at the CF edge for 1 hour per ticker.
 */

import type { HistoricalPrice, AssetType } from '../../src/types/asset';
import type { FxRate } from '../../src/providers/nbpProvider';
import type { ProxyResponse, ErrorCode } from '../../src/types/analyze';

interface Env {
  TWELVE_DATA_API_KEY?: string;
}

// ── Shared types ───────────────────────────────────────────────────────────────

interface MarketQuote {
  ticker: string;
  name: string;
  type: AssetType;
  currency: string;
  currentPrice: number;
  historicalPrices: HistoricalPrice[];
}

class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
  ) {
    super(message);
  }
}

// ── Yahoo Finance ──────────────────────────────────────────────────────────────

interface YahooChartMeta {
  symbol: string;
  longName?: string;
  shortName?: string;
  instrumentType?: string;
  currency?: string;
  regularMarketPrice?: number;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: Array<{ close: (number | null)[] }>;
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

async function fetchFromYahoo(ticker: string): Promise<MarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

  if (res.status === 429) {
    throw new ApiError('RATE_LIMIT_YAHOO', 'RATE_LIMITED', 429);
  }
  if (!res.ok) {
    throw new ApiError(`Yahoo HTTP ${res.status}`, 'UPSTREAM_ERROR', 502);
  }

  const data = await res.json() as YahooChartResponse;

  if (data.chart.error) {
    const desc = data.chart.error.description ?? '';
    const isNotFound = data.chart.error.code === 'Not Found' || desc.toLowerCase().includes('no data');
    throw new ApiError(
      `Ticker not found: ${ticker}`,
      isNotFound ? 'TICKER_NOT_FOUND' : 'UPSTREAM_ERROR',
      isNotFound ? 404 : 502,
    );
  }

  const result = data.chart.result?.[0];
  if (!result?.meta || !result.timestamp?.length) {
    throw new ApiError(`No data found for ticker: ${ticker}`, 'TICKER_NOT_FOUND', 404);
  }

  const { meta, timestamp, indicators } = result;
  const closes = indicators.quote[0]?.close ?? [];

  const currentPrice = meta.regularMarketPrice;
  if (!currentPrice || isNaN(currentPrice)) {
    throw new ApiError(`No market price for ${ticker}`, 'UPSTREAM_ERROR', 502);
  }

  const historicalPrices: HistoricalPrice[] = timestamp
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? NaN,
    }))
    .filter((p) => !isNaN(p.close));

  const instrumentType = (meta.instrumentType ?? '').toUpperCase();
  let type: AssetType = 'stock';
  if (instrumentType === 'ETF') type = 'etf';
  else if (instrumentType === 'CRYPTOCURRENCY') type = 'crypto';
  else if (instrumentType === 'FUTURE') type = 'commodity';

  return {
    ticker: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    type,
    currency: meta.currency ?? 'USD',
    currentPrice,
    historicalPrices,
  };
}

// ── Twelve Data (fallback) ─────────────────────────────────────────────────────

interface TwelveDataMeta {
  symbol: string;
  currency: string;
  type: string;
}

async function fetchFromTwelveData(ticker: string, apiKey: string): Promise<MarketQuote> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(ticker)}&interval=1day&outputsize=504&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'UPSTREAM_ERROR', 502);

  const data = await res.json() as {
    code?: number;
    status?: string;
    message?: string;
    meta?: TwelveDataMeta;
    values?: Array<{ datetime: string; close: string }>;
  };

  if (data.code === 401) throw new ApiError('Invalid Twelve Data API key', 'UPSTREAM_ERROR', 502);
  if (data.code === 429) throw new ApiError('RATE_LIMIT_TWELVEDATA', 'RATE_LIMITED', 429);
  if (data.status === 'error') {
    throw new ApiError(
      data.message ?? `Ticker not found: ${ticker}`,
      'TICKER_NOT_FOUND',
      404,
    );
  }
  if (!data.meta || !data.values?.length) {
    throw new ApiError(`No data found for ticker: ${ticker}`, 'TICKER_NOT_FOUND', 404);
  }

  const values = data.values;
  const currentPrice = parseFloat(values[0].close);
  if (isNaN(currentPrice)) throw new ApiError(`No market price for ${ticker}`, 'UPSTREAM_ERROR', 502);

  const historicalPrices: HistoricalPrice[] = values
    .map((v) => ({ date: v.datetime, close: parseFloat(v.close) }))
    .filter((p) => !isNaN(p.close))
    .reverse();

  const type = (data.meta.type ?? '').toLowerCase();
  let assetType: AssetType = 'stock';
  if (type.includes('etf')) assetType = 'etf';
  else if (type.includes('crypto') || type.includes('digital')) assetType = 'crypto';
  else if (type.includes('commodity') || type.includes('future')) assetType = 'commodity';

  return {
    ticker: data.meta.symbol,
    name: data.meta.symbol,
    type: assetType,
    currency: data.meta.currency || 'USD',
    currentPrice,
    historicalPrices,
  };
}

// ── Market data with fallback ──────────────────────────────────────────────────

async function fetchMarketData(
  ticker: string,
  apiKey?: string,
): Promise<MarketQuote & { source: 'yahoo' | 'twelvedata' }> {
  try {
    return { ...(await fetchFromYahoo(ticker)), source: 'yahoo' };
  } catch (err) {
    // Fall back to Twelve Data only when Yahoo rate-limits us
    const isRateLimit = err instanceof ApiError && err.code === 'RATE_LIMITED';
    if (isRateLimit && apiKey) {
      return { ...(await fetchFromTwelveData(ticker, apiKey)), source: 'twelvedata' };
    }
    throw err;
  }
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

  if (!currentRes.ok) throw new ApiError('Failed to fetch USD/PLN rate from NBP', 'UPSTREAM_ERROR', 502);

  const parseRates = async (r: Response): Promise<FxRate[]> => {
    if (!r.ok) return [];
    const d = await r.json() as { rates?: Array<{ effectiveDate: string; mid: number }> };
    return (d.rates ?? []).map((x) => ({ date: x.effectiveDate, rate: x.mid }));
  };

  const currentData = await currentRes.json() as { rates?: Array<{ mid: number }> };
  if (!currentData.rates?.length) throw new ApiError('NBP returned no current rate', 'UPSTREAM_ERROR', 502);

  const [hist1, hist2] = await Promise.all([parseRates(hist1Res), parseRates(hist2Res)]);

  return {
    currentRate: currentData.rates[0].mid,
    historicalRates: [...hist1, ...hist2],
  };
}

// ── Handler ────────────────────────────────────────────────────────────────────

function errorResponse(code: ErrorCode, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();

  if (!ticker) {
    return errorResponse('INVALID_TICKER', 'Missing required parameter: ticker', 400);
  }

  try {
    const [marketResult, fxResult] = await Promise.all([
      fetchMarketData(ticker, env.TWELVE_DATA_API_KEY),
      fetchFxData(),
    ]);

    const { ticker: sym, name, type, currency, currentPrice, historicalPrices, source } = marketResult;
    const { currentRate, historicalRates } = fxResult;

    const response: ProxyResponse = {
      assetData: {
        asset: { ticker: sym, name, type, currency, currentPrice },
        historicalPrices,
      },
      fxData: { currentRate, historicalRates },
      source,
    };

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err.code, err.message, err.status);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse('UPSTREAM_ERROR', message, 502);
  }
};
