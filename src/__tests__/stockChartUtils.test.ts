/**
 * Unit tests for stockChartUtils — chart data filtering, period change, date formatting.
 */
import { describe, it, expect } from 'vitest';
import {
  filterBySpan,
  calcPeriodChange,
  formatXAxisDate,
  formatIntradayTime,
  tickCount,
  SPANS,
  type SpanKey,
} from '../utils/stockChartUtils';
import type { HistoricalPrice } from '../types/asset';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrices(dates: string[], startClose = 100): HistoricalPrice[] {
  return dates.map((date, i) => ({ date, close: startClose + i }));
}

/** Generate daily dates from start (inclusive) for `count` days. */
function dailyDates(startISO: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(startISO + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// filterBySpan
// ---------------------------------------------------------------------------

describe('filterBySpan', () => {
  it('returns empty array for empty input', () => {
    expect(filterBySpan([], '1M')).toEqual([]);
  });

  it('returns all prices when span covers full range', () => {
    const dates = dailyDates('2024-01-01', 30);
    const prices = makePrices(dates);
    const result = filterBySpan(prices, '1M');
    expect(result.length).toBe(30);
  });

  it('intraday spans return prices as-is (pre-filtered by API)', () => {
    const prices = makePrices(dailyDates('2024-01-01', 10));
    expect(filterBySpan(prices, '1D').length).toBe(10);
    expect(filterBySpan(prices, '1T').length).toBe(10);
  });

  it('1M spans config has 30 days', () => {
    const config = SPANS.find((s) => s.key === '1M');
    expect(config?.days).toBe(30);
  });

  it('2Y returns everything when data is only 1 year long', () => {
    const dates = dailyDates('2024-01-01', 252);
    const prices = makePrices(dates);
    expect(filterBySpan(prices, '2Y').length).toBe(252);
  });

  it('5Y returns everything when data is only 2 years long', () => {
    const dates = dailyDates('2023-01-01', 504);
    const prices = makePrices(dates);
    expect(filterBySpan(prices, '5Y').length).toBe(504);
  });

  it('3M filters correctly — last 91 calendar days', () => {
    // 200 daily prices
    const dates = dailyDates('2023-07-01', 200);
    const prices = makePrices(dates);
    const result = filterBySpan(prices, '3M');
    // 91 calendar days ≈ 63–65 trading days, but we have consecutive calendar days
    expect(result.length).toBeGreaterThanOrEqual(90);
    expect(result.length).toBeLessThanOrEqual(93);
  });

  it('unknown span key returns full prices', () => {
    const prices = makePrices(dailyDates('2024-01-01', 10));
    // @ts-expect-error intentional bad key for test
    expect(filterBySpan(prices, 'BAD').length).toBe(10);
  });

  it('result is sorted ascending (preserves original order)', () => {
    const dates = dailyDates('2024-01-01', 60);
    const prices = makePrices(dates);
    const result = filterBySpan(prices, '1M');
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date >= result[i - 1].date).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// calcPeriodChange
// ---------------------------------------------------------------------------

describe('calcPeriodChange', () => {
  it('returns 0 for empty array', () => {
    expect(calcPeriodChange([])).toBe(0);
  });

  it('returns 0 for single-element array', () => {
    expect(calcPeriodChange([{ date: '2024-01-01', close: 100 }])).toBe(0);
  });

  it('calculates positive change correctly', () => {
    const prices: HistoricalPrice[] = [
      { date: '2024-01-01', close: 100 },
      { date: '2024-01-02', close: 110 },
    ];
    expect(calcPeriodChange(prices)).toBeCloseTo(10, 5);
  });

  it('calculates negative change correctly', () => {
    const prices: HistoricalPrice[] = [
      { date: '2024-01-01', close: 200 },
      { date: '2024-01-05', close: 150 },
    ];
    expect(calcPeriodChange(prices)).toBeCloseTo(-25, 5);
  });

  it('returns 0 when first price is 0 (avoid division by zero)', () => {
    const prices: HistoricalPrice[] = [
      { date: '2024-01-01', close: 0 },
      { date: '2024-01-02', close: 100 },
    ];
    expect(calcPeriodChange(prices)).toBe(0);
  });

  it('handles flat price (no change)', () => {
    const prices: HistoricalPrice[] = [
      { date: '2024-01-01', close: 150 },
      { date: '2024-01-02', close: 150 },
      { date: '2024-01-03', close: 150 },
    ];
    expect(calcPeriodChange(prices)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatXAxisDate
// ---------------------------------------------------------------------------

describe('formatXAxisDate', () => {
  const date = '2025-05-14'; // 14 May 2025

  it('1M: returns day + month name', () => {
    expect(formatXAxisDate(date, '1M')).toBe('14 maj');
  });

  it('3M: returns month name only', () => {
    expect(formatXAxisDate(date, '3M')).toBe('maj');
  });

  it('6M: returns month name only', () => {
    expect(formatXAxisDate(date, '6M')).toBe('maj');
  });

  it('1Y: returns month + 2-digit year', () => {
    expect(formatXAxisDate(date, '1Y')).toBe("maj '25");
  });

  it('2Y: returns month + 2-digit year', () => {
    expect(formatXAxisDate(date, '2Y')).toBe("maj '25");
  });

  it('5Y: returns month + 2-digit year', () => {
    expect(formatXAxisDate(date, '5Y')).toBe("maj '25");
  });

  it('handles January correctly', () => {
    expect(formatXAxisDate('2025-01-01', '1M')).toBe('1 sty');
  });

  it('handles December correctly', () => {
    expect(formatXAxisDate('2025-12-31', '1Y')).toBe("gru '25");
  });

  it('handles cross-year display', () => {
    expect(formatXAxisDate('2026-03-15', '2Y')).toBe("mar '26");
  });
});

// ---------------------------------------------------------------------------
// formatIntradayTime
// ---------------------------------------------------------------------------

describe('formatIntradayTime', () => {
  it('extracts HH:MM from datetime string (UTC)', () => {
    // "2025-01-15 13:30" UTC → some local time
    const result = formatIntradayTime('2025-01-15 13:30');
    // Should be a string of format HH:MM
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns a 5-character string HH:MM', () => {
    expect(formatIntradayTime('2025-06-02 09:05').length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// tickCount
// ---------------------------------------------------------------------------

describe('tickCount', () => {
  const allSpans: SpanKey[] = ['1D', '1T', '1M', '3M', '6M', '1Y', '2Y', '5Y'];

  it('returns a positive integer for every span', () => {
    for (const span of allSpans) {
      const count = tickCount(span);
      expect(count).toBeGreaterThan(0);
      expect(Number.isInteger(count)).toBe(true);
    }
  });

  it('5Y has at least as many ticks as 1M', () => {
    expect(tickCount('5Y')).toBeGreaterThanOrEqual(tickCount('1M'));
  });
});

// ---------------------------------------------------------------------------
// SPANS config completeness
// ---------------------------------------------------------------------------

describe('SPANS config', () => {
  it('contains all 8 expected keys in order', () => {
    const keys = SPANS.map((s) => s.key);
    expect(keys).toEqual(['1D', '1T', '1M', '3M', '6M', '1Y', '2Y', '5Y']);
  });

  it('all spans have positive days', () => {
    for (const span of SPANS) {
      expect(span.days).toBeGreaterThan(0);
    }
  });

  it('1D and 1T are marked as intraday', () => {
    expect(SPANS.find((s) => s.key === '1D')?.intraday).toBe(true);
    expect(SPANS.find((s) => s.key === '1T')?.intraday).toBe(true);
  });

  it('non-intraday spans do not have intraday flag', () => {
    for (const span of SPANS.filter((s) => !s.intraday)) {
      expect(span.intraday).toBeFalsy();
    }
  });

  it('5Y has the most calendar days', () => {
    const maxDays = Math.max(...SPANS.map((s) => s.days));
    expect(SPANS.find((s) => s.key === '5Y')?.days).toBe(maxDays);
  });

  it('all labels are non-empty strings', () => {
    for (const span of SPANS) {
      expect(typeof span.label).toBe('string');
      expect(span.label.length).toBeGreaterThan(0);
    }
  });
});
