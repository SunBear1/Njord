import { useCallback, useMemo, useState } from 'react';
import type { Holding, HoldingDraft, StockHolding, StockHoldingDraft } from '../types/holding';
import type { Position, PositionDraft } from '../types/position';
import { positionDraftToStockHoldingDraft, stockHoldingToPosition } from '../utils/stockHoldingAdapter';

function isStockHolding(holding: Holding): holding is StockHolding {
  return holding.assetClass === 'stock';
}

interface StockPositionsApi {
  addHolding: (draft: HoldingDraft) => Promise<void>;
  updateHolding: (id: string, draft: Partial<HoldingDraft>) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
}

export interface UseStockPositionsResult {
  positions: Position[];
  addPosition: (draft: PositionDraft) => 'added' | 'duplicate';
  confirmMerge: (draft: PositionDraft) => void;
  updatePosition: (id: string, draft: PositionDraft) => void;
  removePosition: (id: string) => void;
  pendingMerge: PositionDraft | null;
  cancelMerge: () => void;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function normalizeSource(source: string): string {
  return source.trim() || 'manual';
}

export function findMatchingPosition(positions: Position[], draft: PositionDraft): Position | undefined {
  const ticker = normalizeTicker(draft.ticker);
  const source = normalizeSource(draft.source);
  return positions.find((p) => p.ticker === ticker && p.source === source);
}

export function useStockPositions(holdings: Holding[], api: StockPositionsApi): UseStockPositionsResult {
  const [pendingMerge, setPendingMerge] = useState<PositionDraft | null>(null);

  const positions = useMemo(
    () => holdings.filter(isStockHolding).map(stockHoldingToPosition),
    [holdings],
  );

  const addPosition = useCallback((draft: PositionDraft): 'added' | 'duplicate' => {
    if (findMatchingPosition(positions, draft)) {
      setPendingMerge(draft);
      return 'duplicate';
    }
    const stockDraft: StockHoldingDraft = positionDraftToStockHoldingDraft(draft);
    api.addHolding(stockDraft).catch(() => { /* error already surfaced via useHoldings' error */ });
    return 'added';
  }, [positions, api]);

  const confirmMerge = useCallback((draft: PositionDraft) => {
    const existing = findMatchingPosition(positions, draft);
    setPendingMerge(null);
    if (!existing) return;
    api.updateHolding(existing.id, positionDraftToStockHoldingDraft(draft))
      .catch(() => { /* error already surfaced via useHoldings' error */ });
  }, [positions, api]);

  const cancelMerge = useCallback(() => {
    setPendingMerge(null);
  }, []);

  const updatePosition = useCallback((id: string, draft: PositionDraft) => {
    api.updateHolding(id, positionDraftToStockHoldingDraft(draft))
      .catch(() => { /* error already surfaced via useHoldings' error */ });
  }, [api]);

  const removePosition = useCallback((id: string) => {
    api.removeHolding(id).catch(() => { /* error already surfaced via useHoldings' error */ });
  }, [api]);

  return { positions, addPosition, confirmMerge, updatePosition, removePosition, pendingMerge, cancelMerge };
}
