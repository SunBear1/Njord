import { describe, expect, it } from 'vitest';
import { findMatchingPosition } from '../hooks/useStockPositions';
import type { Position, PositionDraft } from '../types/position';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos_1',
    ticker: 'AAPL',
    quantity: 10,
    avgPrice: 150,
    currency: 'USD',
    source: 'manual',
    addedAt: Date.now(),
    ...overrides,
  };
}

function makeDraft(overrides: Partial<PositionDraft> = {}): PositionDraft {
  return { ticker: 'AAPL', quantity: '5', avgPrice: '160', currency: 'USD', source: 'manual', ...overrides };
}

describe('findMatchingPosition', () => {
  it('TestFindMatchingPosition_WhenTickerAndSourceMatch_ExpectsThatPositionReturned', () => {
    const existing = makePosition();
    expect(findMatchingPosition([existing], makeDraft())).toBe(existing);
  });

  it('TestFindMatchingPosition_WhenTickerCaseAndSourceWhitespaceDiffer_ExpectsStillMatched', () => {
    const existing = makePosition({ ticker: 'AAPL', source: 'XTB' });
    const draft = makeDraft({ ticker: ' aapl ', source: ' XTB ' });
    expect(findMatchingPosition([existing], draft)).toBe(existing);
  });

  it('TestFindMatchingPosition_WhenSourceDiffers_ExpectsNoMatch', () => {
    const existing = makePosition({ ticker: 'AAPL', source: 'XTB' });
    const draft = makeDraft({ ticker: 'AAPL', source: 'DEGIRO' });
    expect(findMatchingPosition([existing], draft)).toBeUndefined();
  });

  it('TestFindMatchingPosition_WhenTickerDiffers_ExpectsNoMatch', () => {
    const existing = makePosition({ ticker: 'AAPL' });
    const draft = makeDraft({ ticker: 'MSFT' });
    expect(findMatchingPosition([existing], draft)).toBeUndefined();
  });

  it('TestFindMatchingPosition_WhenSourceBlank_ExpectsManualTreatedAsDefaultSource', () => {
    const existing = makePosition({ ticker: 'AAPL', source: 'manual' });
    const draft = makeDraft({ ticker: 'AAPL', source: '   ' });
    expect(findMatchingPosition([existing], draft)).toBe(existing);
  });

  it('TestFindMatchingPosition_WhenNoPositions_ExpectsUndefined', () => {
    expect(findMatchingPosition([], makeDraft())).toBeUndefined();
  });
});
