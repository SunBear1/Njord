/**
 * GET /finance/stocks/search?q=<query>
 *
 * Proxies Yahoo Finance search API — returns simplified ticker results.
 */

import { BAD_REQUEST, UPSTREAM_ERROR, errorResponse } from '../_shared/errors';

interface YahooSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  quoteType: string;
}

interface YahooSearchResponse {
  quotes: YahooSearchResult[];
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();

  if (!query || query.length < 1) {
    return errorResponse(BAD_REQUEST('Missing required parameter: q'));
  }
  if (query.length > 50) {
    return errorResponse(BAD_REQUEST('Query too long (max 50 characters)'));
  }

  const yahooUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

  try {
    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      return errorResponse(UPSTREAM_ERROR(`Yahoo search HTTP ${res.status}`, 'yahoo'));
    }

    const data = (await res.json()) as YahooSearchResponse;

    const results = (data.quotes ?? []).map((q) => ({
      symbol: q.symbol,
      shortname: q.shortname,
      exchange: q.exchange,
      quoteType: q.quoteType,
    }));

    return new Response(JSON.stringify({ data: results, _meta: { source: 'yahoo' } }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',
      },
    });
  } catch {
    return errorResponse(UPSTREAM_ERROR('Failed to search tickers', 'yahoo'));
  }
};
