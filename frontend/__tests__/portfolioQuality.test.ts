import { describe, test, expect } from 'vitest';
import { calcPositionQuality, calcPortfolioQuality } from '../utils/portfolioQuality';
import type { Position } from '../types/position';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'test-id',
    ticker: 'AAPL',
    quantity: 10,
    avgPrice: 150,
    currency: 'USD',
    source: 'manual',
    addedAt: Date.now(),
    ...overrides,
  };
}

const NOW = 1_700_000_000_000; // fixed timestamp for deterministic tests
const FRESH = NOW - 1_000; // 1 second ago
const STALE = NOW - 25 * 60 * 60 * 1000; // 25 hours ago

describe('calcPositionQuality', () => {
  test('complete position with avgPrice > 0 scores 100', () => {
    const q = calcPositionQuality(makePosition({ avgPrice: 150, addedAt: FRESH }), NOW);
    expect(q.score).toBe(100);
    expect(q.tier).toBe('complete');
    expect(q.missingFields).toHaveLength(0);
  });

  test('position with avgPrice = 0 scores 70 and is incomplete', () => {
    const q = calcPositionQuality(makePosition({ avgPrice: 0, addedAt: FRESH }), NOW);
    expect(q.score).toBe(70);
    expect(q.tier).toBe('incomplete');
    expect(q.missingFields).toContain('cena nabycia');
  });

  test('fresh position (< 24h) is not stale', () => {
    const q = calcPositionQuality(makePosition({ addedAt: FRESH }), NOW);
    expect(q.isStale).toBe(false);
  });

  test('position older than 24h is stale', () => {
    const q = calcPositionQuality(makePosition({ addedAt: STALE }), NOW);
    expect(q.isStale).toBe(true);
  });
});

describe('calcPortfolioQuality', () => {
  test('empty portfolio returns 0 score and empty map', () => {
    const q = calcPortfolioQuality([], NOW);
    expect(q.overallScore).toBe(0);
    expect(q.totalCount).toBe(0);
    expect(q.perPosition.size).toBe(0);
  });

  test('single complete fresh position scores 100', () => {
    const pos = makePosition({ avgPrice: 100, addedAt: FRESH });
    const q = calcPortfolioQuality([pos], NOW);
    expect(q.overallScore).toBe(100);
    expect(q.completeCount).toBe(1);
    expect(q.staleCount).toBe(0);
  });

  test('single incomplete position scores 70', () => {
    const pos = makePosition({ avgPrice: 0, addedAt: FRESH });
    const q = calcPortfolioQuality([pos], NOW);
    expect(q.overallScore).toBe(70);
    expect(q.completeCount).toBe(0);
  });

  test('one complete + one incomplete scores 85 (average 85, no stale penalty)', () => {
    const pos1 = makePosition({ id: 'a', avgPrice: 100, addedAt: FRESH });
    const pos2 = makePosition({ id: 'b', avgPrice: 0, addedAt: FRESH });
    const q = calcPortfolioQuality([pos1, pos2], NOW);
    expect(q.overallScore).toBe(85);
    expect(q.completeCount).toBe(1);
    expect(q.totalCount).toBe(2);
  });

  test('stale position reduces overall score', () => {
    const pos1 = makePosition({ id: 'a', avgPrice: 100, addedAt: FRESH });
    const pos2 = makePosition({ id: 'b', avgPrice: 100, addedAt: STALE });
    const fresh = calcPortfolioQuality([pos1], NOW);
    const withStale = calcPortfolioQuality([pos1, pos2], NOW);
    expect(withStale.overallScore).toBeLessThan(fresh.overallScore);
    expect(withStale.staleCount).toBe(1);
  });

  test('perPosition map contains entry for each position', () => {
    const pos1 = makePosition({ id: 'x1', addedAt: FRESH });
    const pos2 = makePosition({ id: 'x2', addedAt: STALE });
    const q = calcPortfolioQuality([pos1, pos2], NOW);
    expect(q.perPosition.has('x1')).toBe(true);
    expect(q.perPosition.has('x2')).toBe(true);
  });
});

// ─── missingFieldSummaries ────────────────────────────────────────────────────

describe('missingFieldSummaries', () => {
  test('empty for all-complete portfolio', () => {
    const pos = makePosition({ avgPrice: 100, addedAt: FRESH });
    const q = calcPortfolioQuality([pos], NOW);
    expect(q.missingFieldSummaries).toHaveLength(0);
  });

  test('contains entry for missing avgPrice with affected tickers', () => {
    const pos1 = makePosition({ id: 'a', ticker: 'AAPL', avgPrice: 0, addedAt: FRESH });
    const pos2 = makePosition({ id: 'b', ticker: 'MSFT', avgPrice: 0, addedAt: FRESH });
    const q = calcPortfolioQuality([pos1, pos2], NOW);
    expect(q.missingFieldSummaries).toHaveLength(1);
    const summary = q.missingFieldSummaries[0];
    expect(summary.field).toBe('cena nabycia');
    expect(summary.affectedTickers).toContain('AAPL');
    expect(summary.affectedTickers).toContain('MSFT');
    expect(summary.impact).toContain('podatku');
  });
});
