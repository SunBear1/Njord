/**
 * Contract snapshot tests for upstream API response shapes.
 *
 * These tests do NOT hit live APIs — they validate that our type-casting
 * assumptions are correct against recorded response fixtures.
 *
 * If a real API breaks (e.g., Yahoo changes field names), the integration
 * tests will catch it. This file focuses on shape validation logic.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Yahoo Finance minimal response shape validator
// (mirrors the assumptions in functions/api/market-data.ts)
// ---------------------------------------------------------------------------

interface YahooMeta {
  regularMarketPrice: number;
  currency: string;
  shortName?: string;
  longName?: string;
  quoteType?: string;
  symbol: string;
}


interface YahooChartResponse {
  chart: {
    result?: [{
      meta: YahooMeta;
      timestamp?: number[];
      indicators?: { adjclose: [{ adjclose: (number | null)[] }] };
    }];
    error?: { code: string; description: string } | null;
  };
}

function validateYahooShape(raw: unknown): { valid: boolean; reason?: string } {
  if (typeof raw !== 'object' || raw === null) return { valid: false, reason: 'not an object' };
  const r = raw as Record<string, unknown>;
  if (!('chart' in r)) return { valid: false, reason: 'missing chart' };
  const chart = r.chart as Record<string, unknown>;
  if (!Array.isArray(chart.result) || chart.result.length === 0) {
    if (chart.error) return { valid: false, reason: `Yahoo error: ${(chart.error as Record<string, string>).description}` };
    return { valid: false, reason: 'no result' };
  }
  const result = chart.result[0] as Record<string, unknown>;
  const meta = result.meta as Record<string, unknown> | undefined;
  if (!meta) return { valid: false, reason: 'missing meta' };
  if (typeof meta.regularMarketPrice !== 'number' || !isFinite(meta.regularMarketPrice) || meta.regularMarketPrice <= 0) {
    return { valid: false, reason: `invalid regularMarketPrice: ${meta.regularMarketPrice}` };
  }
  if (typeof meta.currency !== 'string') return { valid: false, reason: 'missing currency' };
  if (typeof meta.symbol !== 'string') return { valid: false, reason: 'missing symbol' };
  return { valid: true };
}

// Minimal NBP Table A response validator
function validateNbpShape(raw: unknown): { valid: boolean; reason?: string } {
  if (!Array.isArray(raw)) return { valid: false, reason: 'not an array' };
  if (raw.length === 0) return { valid: false, reason: 'empty array' };
  const entry = raw[0] as Record<string, unknown>;
  if (!Array.isArray(entry.rates) || entry.rates.length === 0) return { valid: false, reason: 'missing rates array' };
  const rate = (entry.rates as Record<string, unknown>[])[entry.rates.length - 1];
  if (typeof rate.mid !== 'number' || !isFinite(rate.mid) || rate.mid <= 0) {
    return { valid: false, reason: `invalid mid rate: ${rate.mid}` };
  }
  if (typeof rate.effectiveDate !== 'string') return { valid: false, reason: 'missing effectiveDate' };
  return { valid: true };
}

describe('Yahoo Finance response shape validator', () => {
  it('accepts a well-formed response', () => {
    const response: YahooChartResponse = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150.25, currency: 'USD', symbol: 'AAPL', shortName: 'Apple Inc.' },
          timestamp: [1700000000, 1700086400],
          indicators: { adjclose: [{ adjclose: [148.5, 150.25] }] },
        }],
        error: null,
      },
    };
    expect(validateYahooShape(response)).toEqual({ valid: true });
  });

  it('rejects missing result', () => {
    const response = { chart: { error: { code: 'Not Found', description: 'No fundamentals data found' } } };
    const result = validateYahooShape(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no result|Yahoo error/);
  });

  it('rejects non-finite regularMarketPrice', () => {
    const response: YahooChartResponse = {
      chart: {
        result: [{
          meta: { regularMarketPrice: NaN, currency: 'USD', symbol: 'BAD' },
        }],
      },
    };
    expect(validateYahooShape(response)).toEqual({ valid: false, reason: expect.stringContaining('regularMarketPrice') });
  });

  it('rejects zero price', () => {
    const response: YahooChartResponse = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 0, currency: 'USD', symbol: 'BAD' },
        }],
      },
    };
    expect(validateYahooShape(response).valid).toBe(false);
  });

  it('rejects missing currency', () => {
    const response = {
      chart: {
        result: [{
          meta: { regularMarketPrice: 100, symbol: 'TEST' },
        }],
      },
    };
    expect(validateYahooShape(response).valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateYahooShape(null).valid).toBe(false);
    expect(validateYahooShape('string').valid).toBe(false);
    expect(validateYahooShape(42).valid).toBe(false);
  });
});

describe('NBP Table A response shape validator', () => {
  it('accepts a well-formed response', () => {
    const response = [
      {
        table: 'A',
        currency: 'dolar amerykański',
        code: 'USD',
        rates: [
          { no: '123/A/NBP/2025', effectiveDate: '2025-06-27', mid: 3.9512 },
        ],
      },
    ];
    expect(validateNbpShape(response)).toEqual({ valid: true });
  });

  it('rejects empty array', () => {
    expect(validateNbpShape([])).toEqual({ valid: false, reason: 'empty array' });
  });

  it('rejects missing rates', () => {
    expect(validateNbpShape([{ table: 'A', code: 'USD' }])).toEqual({ valid: false, reason: 'missing rates array' });
  });

  it('rejects zero mid rate', () => {
    const response = [{ rates: [{ effectiveDate: '2025-01-01', mid: 0 }] }];
    expect(validateNbpShape(response).valid).toBe(false);
  });

  it('rejects NaN mid rate', () => {
    const response = [{ rates: [{ effectiveDate: '2025-01-01', mid: NaN }] }];
    expect(validateNbpShape(response).valid).toBe(false);
  });
});
