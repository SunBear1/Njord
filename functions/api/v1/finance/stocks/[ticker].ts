/**
 * GET /api/v1/finance/stocks/:ticker
 *
 * Proxies Yahoo Finance chart API.
 * Query params:
 *   - interval: 5m | 15m | 30m | 1h | 1d | 1wk | 1mo (default "1d")
 *   - range: 1d | 5d | 1mo | 3mo | 6mo | 1y | 2y | 5y (default "1mo")
 */

import type { StockBar, ApiMeta, ApiResponse } from '../_shared/types';
import { BAD_REQUEST, UPSTREAM_ERROR, NOT_FOUND, ApiError, errorResponse } from '../_shared/errors';

const ALLOWED_INTERVALS = new Set(['5m', '15m', '30m', '1h', '1d', '1wk', '1mo']);
const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y']);

// Validation: 5m supports max 1mo range, 1h supports max 2y
const RANGE_ORDER = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y'];

function rangeIndex(range: string): number {
  return RANGE_ORDER.indexOf(range);
}

interface YahooChartMeta {
  regularMarketPrice?: number;
  currency?: string;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }>;
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

export const onRequestGet: PagesFunction<Record<string, unknown>, 'ticker'> = async ({ params, request }) => {
  const ticker = (params.ticker as string)?.toUpperCase();
  if (!ticker || ticker.length > 20 || !/^[A-Z0-9.\-^=]+$/.test(ticker)) {
    return errorResponse(BAD_REQUEST('Invalid or missing ticker'));
  }

  const url = new URL(request.url);
  const interval = url.searchParams.get('interval') ?? '1d';
  const range = url.searchParams.get('range') ?? '1mo';

  if (!ALLOWED_INTERVALS.has(interval)) {
    return errorResponse(BAD_REQUEST(`Invalid interval. Allowed: ${[...ALLOWED_INTERVALS].join(', ')}`));
  }
  if (!ALLOWED_RANGES.has(range)) {
    return errorResponse(BAD_REQUEST(`Invalid range. Allowed: ${[...ALLOWED_RANGES].join(', ')}`));
  }

  // 5m → max 1mo
  if (interval === '5m' && rangeIndex(range) > rangeIndex('1mo')) {
    return errorResponse(BAD_REQUEST('5m interval supports max 1mo range'));
  }
  // 1h → max 2y
  if (interval === '1h' && rangeIndex(range) > rangeIndex('2y')) {
    return errorResponse(BAD_REQUEST('1h interval supports max 2y range'));
  }

  const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`;

  try {
    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 429) {
      return errorResponse(UPSTREAM_ERROR('Rate limited by Yahoo Finance', 'yahoo'));
    }
    if (res.status === 404) {
      return errorResponse(NOT_FOUND(`Ticker not found: ${ticker}`));
    }
    if (!res.ok) {
      return errorResponse(UPSTREAM_ERROR(`Yahoo HTTP ${res.status}`, 'yahoo'));
    }

    const data = (await res.json()) as YahooChartResponse;

    if (data.chart.error) {
      const isNotFound = data.chart.error.code === 'Not Found';
      if (isNotFound) return errorResponse(NOT_FOUND(`Ticker not found: ${ticker}`));
      return errorResponse(UPSTREAM_ERROR(data.chart.error.description, 'yahoo'));
    }

    const result = data.chart.result?.[0];
    if (!result?.timestamp?.length) {
      return errorResponse(NOT_FOUND(`No data for ticker: ${ticker}`));
    }

    const quote = result.indicators.quote[0];
    const bars: StockBar[] = result.timestamp
      .map((timestamp, index) => ({
        timestamp,
        open: quote.open[index] ?? 0,
        high: quote.high[index] ?? 0,
        low: quote.low[index] ?? 0,
        close: quote.close[index] ?? 0,
        volume: quote.volume[index] ?? 0,
      }))
      .filter((bar) => bar.close !== 0);

    const meta = result.meta;
    const body: ApiResponse<StockBar[]> & {
      _meta: ApiMeta & {
        currency?: string;
        currentPrice?: number;
        name?: string;
        type?: string;
      };
    } = {
      data: bars,
      _meta: {
        source: 'yahoo',
        currency: meta?.currency,
        currentPrice: meta?.regularMarketPrice,
        name: meta?.longName ?? meta?.shortName,
        type: meta?.instrumentType === 'ETF' ? 'etf' : 'stock',
      },
    };

    return new Response(JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
    });
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(UPSTREAM_ERROR('Failed to fetch stock data', 'yahoo'));
  }
};
