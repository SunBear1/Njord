import { useState, useCallback, useEffect } from 'react';
import type { Position, PositionDraft } from '../types/position';
import { draftToPosition } from '../types/position';

const STORAGE_KEY = 'njord_positions_v1';

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Position[]) : [];
  } catch {
    return [];
  }
}

function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // Silent fallback — quota exceeded or access denied
  }
}

function generateId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface UsePositionsResult {
  positions: Position[];
  addPosition: (draft: PositionDraft) => 'added' | 'duplicate';
  confirmMerge: (draft: PositionDraft) => void;
  updatePosition: (id: string, draft: PositionDraft) => void;
  removePosition: (id: string) => void;
  pendingMerge: PositionDraft | null;
  cancelMerge: () => void;
}

export function usePositions(): UsePositionsResult {
  const [positions, setPositions] = useState<Position[]>(loadPositions);
  const [pendingMerge, setPendingMerge] = useState<PositionDraft | null>(null);

  useEffect(() => {
    savePositions(positions);
  }, [positions]);

  const addPosition = useCallback((draft: PositionDraft): 'added' | 'duplicate' => {
    const ticker = draft.ticker.trim().toUpperCase();
    const isDuplicate = positions.some(
      (p) => p.ticker === ticker && p.source === 'manual',
    );
    if (isDuplicate) {
      setPendingMerge(draft);
      return 'duplicate';
    }
    setPositions((prev) => [...prev, draftToPosition(draft, generateId())]);
    return 'added';
  }, [positions]);

  const confirmMerge = useCallback((draft: PositionDraft) => {
    const ticker = draft.ticker.trim().toUpperCase();
    setPositions((prev) =>
      prev.map((p) =>
        p.ticker === ticker && p.source === 'manual'
          ? { ...draftToPosition(draft, p.id), addedAt: p.addedAt }
          : p,
      ),
    );
    setPendingMerge(null);
  }, []);

  const cancelMerge = useCallback(() => {
    setPendingMerge(null);
  }, []);

  const updatePosition = useCallback((id: string, draft: PositionDraft) => {
    const newTicker = draft.ticker.trim().toUpperCase();
    setPositions((prev) => {
      const existing = prev.find((p) => p.id === id);
      if (!existing) return prev;
      const tickerChanged = existing.ticker !== newTicker;
      if (tickerChanged) {
        // Ticker change = delete old + add new (preserve addedAt from original)
        const updated = draftToPosition(draft, generateId());
        return prev.filter((p) => p.id !== id).concat({ ...updated, addedAt: existing.addedAt });
      }
      return prev.map((p) =>
        p.id === id ? { ...draftToPosition(draft, p.id), addedAt: p.addedAt } : p,
      );
    });
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { positions, addPosition, confirmMerge, updatePosition, removePosition, pendingMerge, cancelMerge };
}
