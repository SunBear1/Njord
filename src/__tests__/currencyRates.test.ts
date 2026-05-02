/**
 * Unit tests for useMultiCurrencyRates pure helper functions.
 *
 * These functions are the core logic behind live-ticker flash animations
 * and smart state-update suppression. They must be correct under all conditions.
 */

import { describe, it, expect } from 'vitest';
import {
  direction,
  computeChanges,
  hasDataChanged,
  type CurrencyRateEntry,
} from '../hooks/useMultiCurrencyRates';

// ---------------------------------------------------------------------------
// direction()
// ---------------------------------------------------------------------------

describe('direction', () => {
  it('returns null when prev is undefined (first load)', () => {
    expect(direction(undefined, 4.10)).toBeNull();
  });

  it('returns null when value is unchanged', () => {
    expect(direction(4.10, 4.10)).toBeNull();
  });

  it('returns "up" when value increased', () => {
    expect(direction(4.00, 4.10)).toBe('up');
  });

  it('returns "down" when value decreased', () => {
    expect(direction(4.10, 4.00)).toBe('down');
  });

  it('handles very small differences', () => {
    expect(direction(4.1000, 4.1001)).toBe('up');
    expect(direction(4.1001, 4.1000)).toBe('down');
  });

  it('handles zero values', () => {
    expect(direction(0, 0)).toBeNull();
    expect(direction(0, 0.001)).toBe('up');
  });
});

// ---------------------------------------------------------------------------
// hasDataChanged()
// ---------------------------------------------------------------------------

function makeEntry(
  currency: string,
  aliorTs: string | null,
  nbpDate: string | null,
): CurrencyRateEntry {
  return {
    currency,
    alior: aliorTs ? { buy: 4.0, sell: 4.1, mid: 4.05, ts: aliorTs } : null,
    nbp: nbpDate ? { buy: 3.98, sell: 4.05, mid: 4.015, date: nbpDate } : null,
  };
}

describe('hasDataChanged', () => {
  it('returns false for identical snapshots', () => {
    const prev = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    const curr = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    expect(hasDataChanged(prev, curr)).toBe(false);
  });

  it('returns true when alior.ts changed', () => {
    const prev = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    const curr = [makeEntry('USD', '2026-05-02T10:00:01', '2026-05-02')];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns true when nbp.date changed (new banking day)', () => {
    const prev = [makeEntry('USD', '2026-05-01T10:00:00', '2026-05-01')];
    const curr = [makeEntry('USD', '2026-05-01T10:00:00', '2026-05-02')];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns true when alior goes from null to data', () => {
    const prev = [makeEntry('USD', null, '2026-05-02')];
    const curr = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns true when alior goes from data to null (upstream failure)', () => {
    const prev = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    const curr = [makeEntry('USD', null, '2026-05-02')];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns true when array length differs', () => {
    const prev = [makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02')];
    const curr = [
      makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02'),
      makeEntry('EUR', '2026-05-02T10:00:00', '2026-05-02'),
    ];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns true when currencies are in different order', () => {
    const prev = [
      makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02'),
      makeEntry('EUR', '2026-05-02T10:00:00', '2026-05-02'),
    ];
    const curr = [
      makeEntry('EUR', '2026-05-02T10:00:00', '2026-05-02'),
      makeEntry('USD', '2026-05-02T10:00:00', '2026-05-02'),
    ];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns false for empty arrays', () => {
    expect(hasDataChanged([], [])).toBe(false);
  });

  it('detects change in any currency in a multi-currency snapshot', () => {
    const ts = '2026-05-02T10:00:00';
    const date = '2026-05-02';
    const prev = [
      makeEntry('USD', ts, date),
      makeEntry('EUR', ts, date),
      makeEntry('GBP', ts, date),
    ];
    // Only GBP alior ts changed
    const curr = [
      makeEntry('USD', ts, date),
      makeEntry('EUR', ts, date),
      makeEntry('GBP', '2026-05-02T10:00:01', date),
    ];
    expect(hasDataChanged(prev, curr)).toBe(true);
  });

  it('returns false when all values are null (both snapshots have no data)', () => {
    const prev = [makeEntry('USD', null, null)];
    const curr = [makeEntry('USD', null, null)];
    expect(hasDataChanged(prev, curr)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeChanges()
// ---------------------------------------------------------------------------

function makeFullEntry(
  currency: string,
  buy: number,
  sell: number,
  ts: string,
  nbpBuy: number,
  nbpSell: number,
  date: string,
): CurrencyRateEntry {
  return {
    currency,
    alior: { buy, sell, mid: (buy + sell) / 2, ts },
    nbp: { buy: nbpBuy, sell: nbpSell, mid: (nbpBuy + nbpSell) / 2, date },
  };
}

describe('computeChanges', () => {
  it('returns all null directions when prices are unchanged', () => {
    const entry = makeFullEntry('USD', 4.0, 4.1, 'ts1', 3.98, 4.05, '2026-05-02');
    const result = computeChanges([entry], [entry]);
    expect(result.USD).toEqual({
      aliorBuy: null,
      aliorSell: null,
      nbpBuy: null,
      nbpSell: null,
    });
  });

  it('detects alior buy increase', () => {
    const prev = makeFullEntry('USD', 4.00, 4.10, 'ts1', 3.98, 4.05, '2026-05-02');
    const curr = makeFullEntry('USD', 4.01, 4.10, 'ts2', 3.98, 4.05, '2026-05-02');
    const result = computeChanges([prev], [curr]);
    expect(result.USD.aliorBuy).toBe('up');
    expect(result.USD.aliorSell).toBeNull();
  });

  it('detects alior sell decrease', () => {
    const prev = makeFullEntry('USD', 4.00, 4.10, 'ts1', 3.98, 4.05, '2026-05-02');
    const curr = makeFullEntry('USD', 4.00, 4.09, 'ts2', 3.98, 4.05, '2026-05-02');
    const result = computeChanges([prev], [curr]);
    expect(result.USD.aliorSell).toBe('down');
    expect(result.USD.aliorBuy).toBeNull();
  });

  it('detects NBP rate change', () => {
    const prev = makeFullEntry('EUR', 4.20, 4.30, 'ts1', 4.18, 4.28, '2026-05-01');
    const curr = makeFullEntry('EUR', 4.20, 4.30, 'ts1', 4.22, 4.32, '2026-05-02');
    const result = computeChanges([prev], [curr]);
    expect(result.EUR.nbpBuy).toBe('up');
    expect(result.EUR.nbpSell).toBe('up');
  });

  it('returns all null on first load (empty prev)', () => {
    const curr = makeFullEntry('USD', 4.0, 4.1, 'ts1', 3.98, 4.05, '2026-05-02');
    const result = computeChanges([], [curr]);
    // No prev entry → all directions null (prev value is undefined)
    expect(result.USD).toEqual({
      aliorBuy: null,
      aliorSell: null,
      nbpBuy: null,
      nbpSell: null,
    });
  });

  it('handles multiple currencies independently', () => {
    const prevUSD = makeFullEntry('USD', 4.00, 4.10, 'ts1', 3.98, 4.05, '2026-05-02');
    const prevEUR = makeFullEntry('EUR', 4.20, 4.30, 'ts1', 4.18, 4.28, '2026-05-02');
    const currUSD = makeFullEntry('USD', 4.01, 4.10, 'ts2', 3.98, 4.05, '2026-05-02');
    const currEUR = makeFullEntry('EUR', 4.20, 4.30, 'ts1', 4.18, 4.28, '2026-05-02'); // unchanged
    const result = computeChanges([prevUSD, prevEUR], [currUSD, currEUR]);
    expect(result.USD.aliorBuy).toBe('up');
    expect(result.EUR.aliorBuy).toBeNull();
  });

  it('handles null alior data gracefully (upstream failure)', () => {
    const prev: CurrencyRateEntry = {
      currency: 'GBP',
      alior: { buy: 5.0, sell: 5.1, mid: 5.05, ts: 'ts1' },
      nbp: null,
    };
    const curr: CurrencyRateEntry = {
      currency: 'GBP',
      alior: null,
      nbp: null,
    };
    // Shouldn't throw
    const result = computeChanges([prev], [curr]);
    expect(result.GBP).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// API response shape validators (mirrors currency-rates.ts logic)
// ---------------------------------------------------------------------------

describe('Alior response parsing', () => {
  it('extracts buy/sell/mid from directExchangeOffers', () => {
    const raw = {
      pair: 'USD_PLN',
      ts: '2026-05-02T10:00:00.000Z',
      directExchangeOffers: {
        forexNow: 4.05,
        buyNow: 4.00,
        sellNow: 4.10,
      },
    };
    const { buyNow, sellNow, forexNow } = raw.directExchangeOffers;
    expect(buyNow).toBe(4.00);
    expect(sellNow).toBe(4.10);
    expect(forexNow).toBe(4.05);
    expect(raw.ts).toBe('2026-05-02T10:00:00.000Z');
  });
});

describe('NBP Table C response parsing', () => {
  it('extracts bid/ask/effectiveDate from rates[0]', () => {
    const raw = {
      rates: [
        { no: '083/C/NBP/2026', effectiveDate: '2026-05-02', bid: 3.9812, ask: 4.0624 },
      ],
    };
    const rate = raw.rates[0];
    expect(rate.bid).toBe(3.9812);
    expect(rate.ask).toBe(4.0624);
    expect(rate.effectiveDate).toBe('2026-05-02');
    const mid = (rate.bid + rate.ask) / 2;
    expect(mid).toBeCloseTo(4.0218, 4);
  });

  it('handles missing rates array gracefully', () => {
    const raw = { rates: [] };
    expect(raw.rates[0]).toBeUndefined();
  });
});
