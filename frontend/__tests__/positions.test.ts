import { describe, test, expect } from 'vitest';
import {
  validatePositionDraft,
  draftToPosition,
} from '../types/position';
import type { PositionDraft } from '../types/position';

// ─── validatePositionDraft ─────────────────────────────────────────────────────

describe('validatePositionDraft', () => {
  const valid: PositionDraft = {
    ticker: 'AAPL',
    quantity: '10',
    avgPrice: '150.50',
    currency: 'USD',
  };

  test('returns no errors for valid draft', () => {
    expect(validatePositionDraft(valid)).toEqual({});
  });

  test('rejects empty ticker', () => {
    const errors = validatePositionDraft({ ...valid, ticker: '' });
    expect(errors.ticker).toBeDefined();
  });

  test('rejects whitespace-only ticker', () => {
    const errors = validatePositionDraft({ ...valid, ticker: '   ' });
    expect(errors.ticker).toBeDefined();
  });

  test('rejects zero quantity', () => {
    const errors = validatePositionDraft({ ...valid, quantity: '0' });
    expect(errors.quantity).toBeDefined();
  });

  test('rejects negative quantity', () => {
    const errors = validatePositionDraft({ ...valid, quantity: '-5' });
    expect(errors.quantity).toBeDefined();
  });

  test('rejects empty quantity', () => {
    const errors = validatePositionDraft({ ...valid, quantity: '' });
    expect(errors.quantity).toBeDefined();
  });

  test('rejects non-numeric quantity', () => {
    const errors = validatePositionDraft({ ...valid, quantity: 'abc' });
    expect(errors.quantity).toBeDefined();
  });

  test('rejects negative price', () => {
    const errors = validatePositionDraft({ ...valid, avgPrice: '-1' });
    expect(errors.avgPrice).toBeDefined();
  });

  test('rejects empty price', () => {
    const errors = validatePositionDraft({ ...valid, avgPrice: '' });
    expect(errors.avgPrice).toBeDefined();
  });

  test('accepts zero price (unknown avg cost)', () => {
    const errors = validatePositionDraft({ ...valid, avgPrice: '0' });
    expect(errors.avgPrice).toBeUndefined();
  });

  test('returns error for all invalid fields simultaneously', () => {
    const allBad: PositionDraft = { ticker: '', quantity: '0', avgPrice: '-1', currency: 'USD' };
    const errors = validatePositionDraft(allBad);
    expect(errors.ticker).toBeDefined();
    expect(errors.quantity).toBeDefined();
    expect(errors.avgPrice).toBeDefined();
  });
});

// ─── draftToPosition ───────────────────────────────────────────────────────────

describe('draftToPosition', () => {
  const draft: PositionDraft = {
    ticker: 'iwda.l',
    quantity: '12.5',
    avgPrice: '80.25',
    currency: 'USD',
  };

  test('normalises ticker to uppercase', () => {
    const pos = draftToPosition(draft, 'test-id');
    expect(pos.ticker).toBe('IWDA.L');
  });

  test('converts quantity and avgPrice strings to numbers', () => {
    const pos = draftToPosition(draft, 'test-id');
    expect(pos.quantity).toBe(12.5);
    expect(pos.avgPrice).toBe(80.25);
  });

  test('sets source to manual', () => {
    const pos = draftToPosition(draft, 'test-id');
    expect(pos.source).toBe('manual');
  });

  test('preserves provided id', () => {
    const pos = draftToPosition(draft, 'my-id-123');
    expect(pos.id).toBe('my-id-123');
  });

  test('trims whitespace from ticker', () => {
    const pos = draftToPosition({ ...draft, ticker: '  SPY  ' }, 'id');
    expect(pos.ticker).toBe('SPY');
  });
});
