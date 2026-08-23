import type { StockHolding, StockHoldingDraft, StockInstrumentType } from '../types/holding';
import type { Position, PositionDraft } from '../types/position';

export function stockHoldingToPosition(holding: StockHolding): Position {
  return {
    id: holding.id,
    ticker: holding.ticker,
    quantity: holding.quantity,
    avgPrice: holding.avgPrice,
    currency: holding.currency,
    source: holding.source ?? 'manual',
    addedAt: Date.parse(holding.addedAt),
  };
}

export function positionDraftToStockHoldingDraft(draft: PositionDraft, instrumentType: StockInstrumentType): StockHoldingDraft {
  return {
    assetClass: 'stock',
    ticker: draft.ticker.trim().toUpperCase(),
    quantity: parseFloat(draft.quantity),
    avgPrice: parseFloat(draft.avgPrice),
    currency: draft.currency,
    source: draft.source.trim() || 'manual',
    instrumentType,
  };
}

export function positionToStockHoldingDraft(position: Position, instrumentType: StockInstrumentType): StockHoldingDraft {
  return {
    assetClass: 'stock',
    ticker: position.ticker,
    quantity: position.quantity,
    avgPrice: position.avgPrice,
    currency: position.currency,
    source: position.source,
    instrumentType,
  };
}
