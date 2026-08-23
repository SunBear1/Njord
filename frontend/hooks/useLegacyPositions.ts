import { useCallback, useState } from 'react';
import type { Position } from '../types/position';

const LEGACY_STORAGE_KEY = 'njord_positions_v1';

function loadLegacyPositions(): Position[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Position[]) : [];
  } catch {
    return [];
  }
}

export interface UseLegacyPositionsResult {
  legacyPositions: Position[];
  clearLegacyPositions: () => void;
}

export function useLegacyPositions(): UseLegacyPositionsResult {
  const [legacyPositions, setLegacyPositions] = useState<Position[]>(loadLegacyPositions);

  const clearLegacyPositions = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Silent fallback — quota exceeded or access denied
    }
    setLegacyPositions([]);
  }, []);

  return { legacyPositions, clearLegacyPositions };
}
