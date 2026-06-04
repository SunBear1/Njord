import { describe, test, expect } from 'vitest';
import { calcConsolidatedPositions } from '../utils/portfolioConsolidation';
import type { Position } from '../types/position';

function makePos(overrides: Partial<Position> = {}): Position {
  return {
    id: 'id-1',
    ticker: 'AAPL',
    quantity: 10,
    avgPrice: 150,
    currency: 'USD',
    source: 'manual',
    addedAt: Date.now(),
    ...overrides,
  };
}

describe('calcConsolidatedPositions', () => {
  test('returns empty array for no positions', () => {
    expect(calcConsolidatedPositions([])).toEqual([]);
  });

  test('single position — no conflict, quantity and price preserved', () => {
    const pos = makePos();
    const result = calcConsolidatedPositions([pos]);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('AAPL');
    expect(result[0].totalQuantity).toBe(10);
    expect(result[0].weightedAvgPrice).toBe(150);
    expect(result[0].hasConflict).toBe(false);
  });

  test('two positions from different sources, same price — no conflict', () => {
    const pos1 = makePos({ id: 'a', source: 'manual', quantity: 10, avgPrice: 150 });
    const pos2 = makePos({ id: 'b', source: 'DEGIRO', quantity: 10, avgPrice: 151 }); // within 2%, same qty
    const result = calcConsolidatedPositions([pos1, pos2]);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(20);
    expect(result[0].hasConflict).toBe(false);
  });

  test('price conflict detected when sources disagree by >2%', () => {
    const pos1 = makePos({ id: 'a', source: 'manual', quantity: 10, avgPrice: 100 });
    const pos2 = makePos({ id: 'b', source: 'DEGIRO', quantity: 10, avgPrice: 110 }); // 10% diff
    const result = calcConsolidatedPositions([pos1, pos2]);
    expect(result[0].hasConflict).toBe(true);
    expect(result[0].conflictKind).toContain('price');
  });

  test('quantity conflict detected when sources have different quantities', () => {
    const pos1 = makePos({ id: 'a', source: 'manual', quantity: 10, avgPrice: 150 });
    const pos2 = makePos({ id: 'b', source: 'DEGIRO', quantity: 20, avgPrice: 151 }); // within 2%
    const result = calcConsolidatedPositions([pos1, pos2]);
    expect(result[0].hasConflict).toBe(true);
    expect(result[0].conflictKind).toContain('quantity');
  });

  test('weighted average price is calculated correctly', () => {
    // 10 @ 100 + 10 @ 200 = weighted avg 150
    const pos1 = makePos({ id: 'a', source: 'manual', quantity: 10, avgPrice: 100 });
    const pos2 = makePos({ id: 'b', source: 'DEGIRO', quantity: 10, avgPrice: 200 });
    const result = calcConsolidatedPositions([pos1, pos2]);
    expect(result[0].weightedAvgPrice).toBe(150);
  });

  test('groups different tickers as separate consolidated positions', () => {
    const posA = makePos({ id: 'a', ticker: 'AAPL', source: 'manual' });
    const posB = makePos({ id: 'b', ticker: 'MSFT', source: 'manual' });
    const result = calcConsolidatedPositions([posA, posB]);
    expect(result).toHaveLength(2);
    const tickers = result.map((r) => r.ticker);
    expect(tickers).toContain('AAPL');
    expect(tickers).toContain('MSFT');
  });

  test('sources list contains entry per source', () => {
    const pos1 = makePos({ id: 'a', source: 'manual' });
    const pos2 = makePos({ id: 'b', source: 'DEGIRO', avgPrice: 200 });
    const result = calcConsolidatedPositions([pos1, pos2]);
    expect(result[0].sources).toHaveLength(2);
    expect(result[0].sources.map((s) => s.source)).toContain('manual');
    expect(result[0].sources.map((s) => s.source)).toContain('DEGIRO');
  });
});
