/**
 * Integration tests — real API fetches for stocks and ETFs.
 *
 * These tests call Yahoo Finance via the same code path as the Pages Function.
 * They validate that:
 *   1. Stock tickers (AAPL) return valid data
 *   2. ETF tickers (IWDA.L, VWCE.DE, SPY) return valid data with type='etf'
 *   3. Invalid tickers return structured errors
 *   4. computeCAGR produces reasonable values from real history
 *
 * NOTE: Requires network access. May fail if Yahoo Finance rate-limits.
 * These tests hit the Yahoo Finance API directly (same as the Pages Function).
 */

import { describe, it, expect } from 'vitest';
import type { HistoricalPrice, AssetType } from '../types/asset';

// ---------------------------------------------------------------------------
// Yahoo Finance fetch — extracted from functions/api/market-data.ts
// (We can't import the Pages Function directly, so we duplicate the fetch logic)
// ---------------------------------------------------------------------------

interface MarketQuote {
  ticker: string;
  name: string;
  type: AssetType;
  currency: string;
  currentPrice: number;
  historicalPrices: HistoricalPrice[];
}

async function fetchFromYahoo(ticker: string): Promise<MarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

  if (res.status === 429) throw new Error('RATE_LIMITED');
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  if (data.chart.error) {
    throw new Error(`TICKER_NOT_FOUND: ${data.chart.error.description ?? ticker}`);
  }

  const result = data.chart.result?.[0];
  if (!result?.meta || !result.timestamp?.length) {
    throw new Error(`TICKER_NOT_FOUND: No data for ${ticker}`);
  }

  const { meta, timestamp, indicators } = result;
  const closes = indicators.quote[0]?.close ?? [];

  const historicalPrices: HistoricalPrice[] = timestamp
    .map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? NaN,
    }))
    .filter((p: HistoricalPrice) => !isNaN(p.close));

  const instrumentType = (meta.instrumentType ?? '').toUpperCase();
  let type: AssetType = 'stock';
  if (instrumentType === 'ETF') type = 'etf';

  return {
    ticker: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    type,
    currency: meta.currency ?? 'USD',
    currentPrice: meta.regularMarketPrice,
    historicalPrices,
  };
}

// ---------------------------------------------------------------------------
// computeCAGR — extracted from src/hooks/useEtfData.ts for testing
// ---------------------------------------------------------------------------

function computeCAGR(prices: HistoricalPrice[]): number | null {
  if (prices.length < 2) return null;
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].close;
  const last = sorted[sorted.length - 1].close;
  if (first <= 0 || last <= 0) return null;
  const tradingYears = sorted.length / 252;
  return (Math.pow(last / first, 1 / tradingYears) - 1) * 100;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Stock data fetching', () => {
  it('fetches AAPL with valid stock data', async () => {
    const data = await fetchFromYahoo('AAPL');

    expect(data.ticker).toBe('AAPL');
    expect(data.name).toMatch(/Apple/i);
    expect(data.type).toBe('stock');
    expect(data.currency).toBe('USD');
    expect(data.currentPrice).toBeGreaterThan(50);
    expect(data.currentPrice).toBeLessThan(1000);
    expect(data.historicalPrices.length).toBeGreaterThan(200);
  }, 15_000);

  it('fetches MSFT with valid stock data', async () => {
    const data = await fetchFromYahoo('MSFT');

    expect(data.ticker).toBe('MSFT');
    expect(data.type).toBe('stock');
    expect(data.currentPrice).toBeGreaterThan(100);
    expect(data.historicalPrices.length).toBeGreaterThan(200);
  }, 15_000);
});

describe('Integration: ETF data fetching', () => {
  it('fetches IWDA.L (iShares Core MSCI World, default ETF)', async () => {
    const data = await fetchFromYahoo('IWDA.L');

    expect(data.ticker).toBe('IWDA.L');
    expect(data.name).toMatch(/MSCI World/i);
    expect(data.type).toBe('etf');
    expect(data.currency).toBe('USD');
    expect(data.currentPrice).toBeGreaterThan(10);
    expect(data.historicalPrices.length).toBeGreaterThan(200);

    // CAGR should be in a reasonable range for MSCI World (~5-15% long term)
    const cagr = computeCAGR(data.historicalPrices);
    expect(cagr).not.toBeNull();
    expect(cagr!).toBeGreaterThan(-30);
    expect(cagr!).toBeLessThan(50);
  }, 15_000);

  it('fetches IWDA.AS (Amsterdam listing, EUR)', async () => {
    const data = await fetchFromYahoo('IWDA.AS');

    expect(data.ticker).toBe('IWDA.AS');
    expect(data.type).toBe('etf');
    expect(data.currency).toBe('EUR');
    expect(data.historicalPrices.length).toBeGreaterThan(200);
  }, 15_000);

  it('fetches VWCE.DE (Vanguard FTSE All-World, Xetra)', async () => {
    const data = await fetchFromYahoo('VWCE.DE');

    expect(data.ticker).toBe('VWCE.DE');
    expect(data.name).toMatch(/Vanguard.*All.World/i);
    expect(data.type).toBe('etf');
    expect(data.historicalPrices.length).toBeGreaterThan(200);
  }, 15_000);

  it('fetches URTH (iShares MSCI World, US-listed)', async () => {
    const data = await fetchFromYahoo('URTH');

    expect(data.ticker).toBe('URTH');
    expect(data.type).toBe('etf');
    expect(data.currency).toBe('USD');
    expect(data.historicalPrices.length).toBeGreaterThan(200);
  }, 15_000);

  it('fetches SPY (SPDR S&P 500)', async () => {
    const data = await fetchFromYahoo('SPY');

    expect(data.ticker).toBe('SPY');
    expect(data.type).toBe('etf');
    expect(data.currency).toBe('USD');
    expect(data.currentPrice).toBeGreaterThan(200);
  }, 15_000);
});

describe('Integration: CAGR computation from real data', () => {
  it('IWDA.L CAGR is in a plausible range', async () => {
    const data = await fetchFromYahoo('IWDA.L');
    const cagr = computeCAGR(data.historicalPrices);

    expect(cagr).not.toBeNull();
    // 2-year window: MSCI World CAGR typically -20% to +30%
    expect(cagr!).toBeGreaterThan(-20);
    expect(cagr!).toBeLessThan(30);
  }, 15_000);

  it('SPY CAGR is in a plausible range', async () => {
    const data = await fetchFromYahoo('SPY');
    const cagr = computeCAGR(data.historicalPrices);

    expect(cagr).not.toBeNull();
    expect(cagr!).toBeGreaterThan(-20);
    expect(cagr!).toBeLessThan(40);
  }, 15_000);
});

describe('Integration: Error handling', () => {
  it('rejects invalid ticker with error', async () => {
    await expect(fetchFromYahoo('XXXNOTREAL123'))
      .rejects
      .toThrow(/TICKER_NOT_FOUND|HTTP 404|Not Found/);
  }, 15_000);
});
