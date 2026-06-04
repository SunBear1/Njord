/**
 * Pure utility functions for the historical stock price chart.
 * No DOM access, no fetch, no side effects.
 */

import type { HistoricalPrice } from '../types/asset';

export type SpanKey = '1D' | '1T' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y';

export interface SpanConfig {
  key: SpanKey;
  label: string;
  /** Calendar days to look back from today (unused for intraday spans) */
  days: number;
  /** True for 1D/1T — data is fetched separately from /api/intraday */
  intraday?: boolean;
}

export const SPANS: SpanConfig[] = [
  { key: '1D', label: '1D',  days: 1,    intraday: true  },
  { key: '1T', label: '1T',  days: 7,    intraday: true  },
  { key: '1M', label: '1M',  days: 30                    },
  { key: '3M', label: '3M',  days: 91                    },
  { key: '6M', label: '6M',  days: 182                   },
  { key: '1Y', label: '1R',  days: 365                   },
  { key: '2Y', label: '2R',  days: 730                   },
  { key: '5Y', label: '5R',  days: 1825                  },
];

/**
 * Filter historical prices to the last N calendar days relative to the most
 * recent data point (not `Date.now()`, so tests are deterministic).
 */
export function filterBySpan(prices: HistoricalPrice[], span: SpanKey): HistoricalPrice[] {
  if (prices.length === 0) return [];

  const config = SPANS.find((s) => s.key === span);
  // Intraday spans are pre-filtered by the API — return as-is
  if (!config || config.intraday) return prices;

  // Use last available date as reference so offline/cached data still works
  const lastDate = new Date(prices[prices.length - 1].date);
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - config.days);

  return prices.filter((p) => new Date(p.date) >= cutoff);
}

/**
 * Percentage change from the first to the last price in a series.
 * Returns 0 when there are fewer than 2 data points.
 */
export function calcPeriodChange(prices: HistoricalPrice[]): number {
  if (prices.length < 2) return 0;
  const first = prices[0].close;
  const last = prices[prices.length - 1].close;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}

/**
 * Format an intraday datetime string ("2025-01-15 14:30") for the X-axis.
 * Returns "HH:MM" in local time.
 */
export function formatIntradayTime(dateStr: string): string {
  // dateStr is "YYYY-MM-DD HH:MM" (UTC stored by the API)
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Format a date string (YYYY-MM-DD) for the X-axis depending on span.
 *
 * - 1M        → "3 maj"  (day + abbreviated month)
 * - 3M / 6M  → "maj"    (abbreviated month name)
 * - 1Y / 2Y / 5Y → "maj '25" (month + short year)
 */
export function formatXAxisDate(dateStr: string, span: SpanKey): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const month = months[d.getMonth()];

  if (span === '1M') {
    return `${d.getDate()} ${month}`;
  }
  if (span === '3M' || span === '6M') {
    return month;
  }
  // 1Y / 2Y / 5Y
  return `${month} '${String(d.getFullYear()).slice(2)}`;
}

/**
 * Determine how many ticks to show on the X-axis for a given span.
 * Keeps the chart readable without overlapping labels.
 */
export function tickCount(span: SpanKey): number {
  switch (span) {
    case '1D':  return 6;
    case '1T':  return 5;
    case '1M':  return 6;
    case '3M':  return 6;
    case '6M':  return 6;
    case '1Y':  return 6;
    case '2Y':  return 8;
    case '5Y':  return 8;
  }
}
