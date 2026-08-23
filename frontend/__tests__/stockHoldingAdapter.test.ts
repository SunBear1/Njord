import { describe, expect, it } from 'vitest';
import {
  positionDraftToStockHoldingDraft,
  positionToStockHoldingDraft,
  stockHoldingToPosition,
} from '../utils/stockHoldingAdapter';
import type { StockHolding } from '../types/holding';
import type { Position, PositionDraft } from '../types/position';

describe('stockHoldingToPosition', () => {
  it('TestStockHoldingToPosition_WhenGivenIsoAddedAt_ExpectsEpochMillisConversion', () => {
    const holding: StockHolding = {
      id: 'h1',
      assetClass: 'stock',
      ticker: 'AAPL',
      quantity: 10,
      avgPrice: 150.25,
      currency: 'USD',
      source: 'manual',
      addedAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    };

    const position = stockHoldingToPosition(holding);

    expect(position).toEqual<Position>({
      id: 'h1',
      ticker: 'AAPL',
      quantity: 10,
      avgPrice: 150.25,
      currency: 'USD',
      source: 'manual',
      addedAt: Date.parse('2026-01-15T10:00:00.000Z'),
    });
  });

  it('TestStockHoldingToPosition_WhenSourceIsNull_ExpectsManualFallback', () => {
    const holding: StockHolding = {
      id: 'h2',
      assetClass: 'stock',
      ticker: 'CDR.WA',
      quantity: 5,
      avgPrice: 78.4,
      currency: 'PLN',
      source: null,
      addedAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };

    expect(stockHoldingToPosition(holding).source).toBe('manual');
  });
});

describe('positionDraftToStockHoldingDraft', () => {
  it('TestPositionDraftToStockHoldingDraft_WhenGivenFormStrings_ExpectsParsedNumericDraft', () => {
    const draft: PositionDraft = {
      ticker: '  aapl ',
      quantity: '10',
      avgPrice: '150.25',
      currency: 'USD',
      source: '  XTB ',
    };

    expect(positionDraftToStockHoldingDraft(draft, 'stock')).toEqual({
      assetClass: 'stock',
      ticker: 'AAPL',
      quantity: 10,
      avgPrice: 150.25,
      currency: 'USD',
      source: 'XTB',
      instrumentType: 'stock',
    });
  });

  it('TestPositionDraftToStockHoldingDraft_WhenSourceIsBlank_ExpectsManualFallback', () => {
    const draft: PositionDraft = { ticker: 'IWDA.L', quantity: '2', avgPrice: '90', currency: 'EUR', source: '   ' };
    expect(positionDraftToStockHoldingDraft(draft, 'etf').source).toBe('manual');
  });

  it('TestPositionDraftToStockHoldingDraft_WhenInstrumentTypeIsEtf_ExpectsEtfInDraft', () => {
    const draft: PositionDraft = { ticker: 'IWDA.L', quantity: '2', avgPrice: '90', currency: 'EUR', source: 'manual' };
    expect(positionDraftToStockHoldingDraft(draft, 'etf').instrumentType).toBe('etf');
  });
});

describe('positionToStockHoldingDraft', () => {
  it('TestPositionToStockHoldingDraft_WhenGivenParsedPosition_ExpectsEquivalentDraft', () => {
    const position: Position = {
      id: 'pos_1',
      ticker: 'MSFT',
      quantity: 3,
      avgPrice: 420.5,
      currency: 'USD',
      source: 'DEGIRO',
      addedAt: Date.now(),
    };

    expect(positionToStockHoldingDraft(position, 'stock')).toEqual({
      assetClass: 'stock',
      ticker: 'MSFT',
      quantity: 3,
      avgPrice: 420.5,
      currency: 'USD',
      source: 'DEGIRO',
      instrumentType: 'stock',
    });
  });
});
