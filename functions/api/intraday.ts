/**
 * Pages Function: GET /api/intraday?ticker=AAPL&span=1D|1T
 *
 * Returns intraday price data:
 *   1D → today's prices, 5-minute intervals   (range=1d&interval=5m)
 *   1T → last 5 trading days, 30-min intervals (range=5d&interval=30m)
 *
 * Cached at CF edge for 5 minutes (shorter than /api/market-data).
 * No FX data — prices are in the asset's native currency.
 */

import type { HistoricalPrice } from '../../src/types/asset';
import type { ErrorCode } from '../../src/types/marketData';

// ── Yahoo Finance ──────────────────────────────────────────────────────────────

interface YahooChartMeta {
  regularMarketPrice?: number;
  currency?: string;
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

class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number,
  ) {
    super(message);
  }
}

const SPAN_CONFIG: Record<'1D' | '1T', { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '1T': { range: '5d', interval: '30m' },
};

async function fetchIntraday(ticker: string, span: '1D' | '1T'): Promise<HistoricalPrice[]> {
  const { range, interval } = SPAN_CONFIG[span];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

  if (res.status === 429) {
    throw new ApiError('Rate limited by Yahoo Finance', 'RATE_LIMITED', 429);
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
  if (!result?.timestamp?.length) {
    throw new ApiError(`No intraday data found for ticker: ${ticker}`, 'TICKER_NOT_FOUND', 404);
  }

  const closes = result.indicators.quote[0]?.close ?? [];

  return result.timestamp
    .map((ts, i) => ({
      // ISO datetime string: "2025-01-15T14:30:00"
      date: new Date(ts * 1000).toISOString().slice(0, 16).replace('T', ' '),
      close: closes[i] ?? NaN,
    }))
    .filter((p) => !isNaN(p.close));
}

// ── Handler ────────────────────────────────────────────────────────────────────

function errorResponse(code: ErrorCode, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const ticker = url.searchParams.get('ticker')?.trim().toUpperCase();
  const span = url.searchParams.get('span')?.toUpperCase();

  if (!ticker) {
    return errorResponse('INVALID_TICKER', 'Missing required parameter: ticker', 400);
  }
  if (ticker.length > 20 || !/^[A-Z0-9.\-^=]+$/.test(ticker)) {
    return errorResponse('INVALID_TICKER', 'Invalid ticker format', 400);
  }
  if (span !== '1D' && span !== '1T') {
    return errorResponse('INVALID_TICKER', 'span must be 1D or 1T', 400);
  }

  try {
    const prices = await fetchIntraday(ticker, span);
    return new Response(JSON.stringify({ prices }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
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
