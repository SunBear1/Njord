import { describe, expect, it } from 'vitest';
import { calcStockHoldingsValuePLN, distinctNonPlnCurrencies } from '../hooks/usePortfolioValuation';
import type { StockHolding } from '../types/holding';

function makeStockHolding(overrides: Partial<StockHolding> = {}): StockHolding {
  return {
    id: 'h1',
    assetClass: 'stock',
    ticker: 'AAPL',
    quantity: 10,
    avgPrice: 150,
    currency: 'USD',
    source: 'manual',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('distinctNonPlnCurrencies', () => {
  it('TestDistinctNonPlnCurrencies_WhenMultipleTickersShareACurrency_ExpectsOneEntryNotPerTicker', () => {
    const holdings = [
      makeStockHolding({ id: 'h1', ticker: 'AAPL', currency: 'USD' }),
      makeStockHolding({ id: 'h2', ticker: 'MSFT', currency: 'USD' }),
      makeStockHolding({ id: 'h3', ticker: 'GOOGL', currency: 'USD' }),
    ];
    expect(distinctNonPlnCurrencies(holdings)).toEqual(['USD']);
  });

  it('TestDistinctNonPlnCurrencies_WhenMixedCurrencies_ExpectsSortedDistinctList', () => {
    const holdings = [
      makeStockHolding({ id: 'h1', currency: 'GBP' }),
      makeStockHolding({ id: 'h2', currency: 'USD' }),
      makeStockHolding({ id: 'h3', currency: 'EUR' }),
      makeStockHolding({ id: 'h4', currency: 'USD' }),
    ];
    expect(distinctNonPlnCurrencies(holdings)).toEqual(['EUR', 'GBP', 'USD']);
  });

  it('TestDistinctNonPlnCurrencies_WhenAllPln_ExpectsEmptyList', () => {
    const holdings = [makeStockHolding({ currency: 'PLN' })];
    expect(distinctNonPlnCurrencies(holdings)).toEqual([]);
  });

  it('TestDistinctNonPlnCurrencies_WhenNoHoldings_ExpectsEmptyList', () => {
    expect(distinctNonPlnCurrencies([])).toEqual([]);
  });
});

describe('calcStockHoldingsValuePLN', () => {
  it('TestCalcStockHoldingsValuePLN_WhenPlnHolding_ExpectsNoConversionNeeded', () => {
    const holdings = [makeStockHolding({ quantity: 10, avgPrice: 100, currency: 'PLN' })];
    expect(calcStockHoldingsValuePLN(holdings, {})).toBe(1000);
  });

  it('TestCalcStockHoldingsValuePLN_WhenRateResolved_ExpectsConvertedValue', () => {
    const holdings = [makeStockHolding({ quantity: 10, avgPrice: 150, currency: 'USD' })];
    expect(calcStockHoldingsValuePLN(holdings, { USD: 4 })).toBe(6000);
  });

  it('TestCalcStockHoldingsValuePLN_WhenRateNotYetResolved_ExpectsHoldingExcludedFromSum', () => {
    const holdings = [
      makeStockHolding({ id: 'h1', quantity: 10, avgPrice: 150, currency: 'USD' }),
      makeStockHolding({ id: 'h2', quantity: 5, avgPrice: 100, currency: 'PLN' }),
    ];
    expect(calcStockHoldingsValuePLN(holdings, {})).toBe(500);
  });

  it('TestCalcStockHoldingsValuePLN_WhenMultipleHoldingsSameCurrency_ExpectsSummedValue', () => {
    const holdings = [
      makeStockHolding({ id: 'h1', quantity: 10, avgPrice: 150, currency: 'USD' }),
      makeStockHolding({ id: 'h2', quantity: 2, avgPrice: 50, currency: 'USD' }),
    ];
    expect(calcStockHoldingsValuePLN(holdings, { USD: 4 })).toBe((1500 + 100) * 4);
  });
});
