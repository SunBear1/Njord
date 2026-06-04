import type { Position } from '../types/position';

/** Relative price tolerance to consider values "conflicting" (>2% difference). */
const CONFLICT_THRESHOLD = 0.02;

export interface ConsolidatedSource {
  source: string;
  quantity: number;
  avgPrice: number;
  positionId: string;
}

export type ConflictKind = 'price' | 'quantity' | 'price_and_quantity';

export interface ConsolidatedPosition {
  ticker: string;
  totalQuantity: number;
  /** Weighted-average price across sources (0 if any source has no avg price). */
  weightedAvgPrice: number;
  currency: string;
  sources: ConsolidatedSource[];
  hasConflict: boolean;
  conflictKind?: ConflictKind;
}

function priceDiffRatio(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const avg = (Math.abs(a) + Math.abs(b)) / 2;
  return avg === 0 ? 0 : Math.abs(a - b) / avg;
}

export function calcConsolidatedPositions(positions: Position[]): ConsolidatedPosition[] {
  const grouped = new Map<string, Position[]>();
  for (const p of positions) {
    const existing = grouped.get(p.ticker);
    if (existing) existing.push(p);
    else grouped.set(p.ticker, [p]);
  }

  return Array.from(grouped.entries()).map(([ticker, group]) => {
    const currency = group[0].currency;
    const totalQuantity = group.reduce((sum, p) => sum + p.quantity, 0);

    // Weighted-average price: weight = quantity
    const weightedAvgPrice =
      totalQuantity > 0
        ? group.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0) / totalQuantity
        : 0;

    const sources: ConsolidatedSource[] = group.map((p) => ({
      source: p.source,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      positionId: p.id,
    }));

    let hasConflict = false;
    let conflictKind: ConflictKind | undefined;

    if (group.length > 1) {
      const prices = group.map((p) => p.avgPrice);
      const quantities = group.map((p) => p.quantity);
      const priceConflict = prices.some(
        (p) => priceDiffRatio(p, prices[0]) > CONFLICT_THRESHOLD,
      );
      const quantityConflict = quantities.some((q) => q !== quantities[0]);

      if (priceConflict && quantityConflict) {
        hasConflict = true;
        conflictKind = 'price_and_quantity';
      } else if (priceConflict) {
        hasConflict = true;
        conflictKind = 'price';
      } else if (quantityConflict) {
        hasConflict = true;
        conflictKind = 'quantity';
      }
    }

    return { ticker, totalQuantity, weightedAvgPrice, currency, sources, hasConflict, conflictKind };
  });
}
