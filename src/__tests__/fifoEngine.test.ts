import { describe, it, expect } from 'vitest';
import { matchFifo } from '../utils/fifoEngine';
import type { FifoLot, FifoSell } from '../types/tax';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeLot = (overrides: Partial<FifoLot> & Pick<FifoLot, 'id' | 'quantity' | 'pricePerShare' | 'date'>): FifoLot => ({
  ticker: 'AAPL',
  brokerFee: 0,
  currency: 'USD',
  nbpRate: 4.0,
  zeroCost: false,
  ...overrides,
});

const makeSell = (overrides: Partial<FifoSell> & Pick<FifoSell, 'id' | 'quantity' | 'pricePerShare' | 'date'>): FifoSell => ({
  ticker: 'AAPL',
  brokerFee: 0,
  currency: 'USD',
  nbpRate: 4.0,
  ...overrides,
});

// ─── Basic FIFO ordering ──────────────────────────────────────────────────────

describe('matchFifo — basic FIFO', () => {
  it('single lot, single sell — full match', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 100 })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 10, pricePerShare: 150 })];

    const { results, remainingLots } = matchFifo(lots, sells);

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.sellId).toBe('S1');
    expect(r.matchedLots).toHaveLength(1);
    expect(r.matchedLots[0].lotId).toBe('L1');
    expect(r.matchedLots[0].quantity).toBe(10);
    expect(r.unmatchedQuantity).toBe(0);
    // Revenue: 10 × 150 × 4.0 = 6,000
    expect(r.revenuePLN).toBe(6_000);
    // Cost: 10 × 100 × 4.0 = 4,000
    expect(r.costPLN).toBe(4_000);
    expect(r.gainPLN).toBe(2_000);
    expect(r.taxPLN).toBe(380); // 19% × 2,000
    expect(remainingLots).toHaveLength(0);
  });

  it('consumes oldest lot first (FIFO)', () => {
    const lots = [
      makeLot({ id: 'L1', date: '2024-01-10', quantity: 5, pricePerShare: 80 }),
      makeLot({ id: 'L2', date: '2024-03-15', quantity: 5, pricePerShare: 120 }),
    ];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 5, pricePerShare: 150 })];

    const { results } = matchFifo(lots, sells);
    expect(results[0].matchedLots).toHaveLength(1);
    expect(results[0].matchedLots[0].lotId).toBe('L1'); // oldest first
    expect(results[0].matchedLots[0].costPerShare).toBe(80);
  });

  it('sell spans multiple lots', () => {
    const lots = [
      makeLot({ id: 'L1', date: '2024-01-10', quantity: 3, pricePerShare: 80 }),
      makeLot({ id: 'L2', date: '2024-02-20', quantity: 5, pricePerShare: 100 }),
    ];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 7, pricePerShare: 150 })];

    const { results, remainingLots } = matchFifo(lots, sells);
    const r = results[0];
    expect(r.matchedLots).toHaveLength(2);
    expect(r.matchedLots[0].lotId).toBe('L1');
    expect(r.matchedLots[0].quantity).toBe(3);
    expect(r.matchedLots[1].lotId).toBe('L2');
    expect(r.matchedLots[1].quantity).toBe(4);
    expect(r.unmatchedQuantity).toBe(0);
    // 1 share remaining in L2
    expect(remainingLots).toHaveLength(1);
    expect(remainingLots[0].lotId).toBe('L2');
    expect(remainingLots[0].remaining).toBe(1);
  });

  it('partial sell — leaves remainder in lot', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 100 })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 4, pricePerShare: 150 })];

    const { results, remainingLots } = matchFifo(lots, sells);
    expect(results[0].matchedLots[0].quantity).toBe(4);
    expect(remainingLots).toHaveLength(1);
    expect(remainingLots[0].remaining).toBe(6);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('matchFifo — edge cases', () => {
  it('sell with no matching lots → unmatchedQuantity', () => {
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 10, pricePerShare: 150 })];

    const { results } = matchFifo([], sells);
    expect(results[0].unmatchedQuantity).toBe(10);
    expect(results[0].costPLN).toBe(0);
  });

  it('no sells → no results, all lots remain', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 100 })];

    const { results, remainingLots } = matchFifo(lots, []);
    expect(results).toHaveLength(0);
    expect(remainingLots).toHaveLength(1);
    expect(remainingLots[0].remaining).toBe(10);
  });

  it('sell before any lot purchase date → unmatched', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-06-01', quantity: 10, pricePerShare: 100 })];
    const sells = [makeSell({ id: 'S1', date: '2024-03-15', quantity: 5, pricePerShare: 150 })];

    const { results } = matchFifo(lots, sells);
    expect(results[0].unmatchedQuantity).toBe(5);
    expect(results[0].matchedLots).toHaveLength(0);
  });

  it('zero-cost lot (RSU/grant) — cost basis is zero', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 0, zeroCost: true })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 10, pricePerShare: 150 })];

    const { results } = matchFifo(lots, sells);
    expect(results[0].revenuePLN).toBe(6_000);
    expect(results[0].costPLN).toBe(0);
    expect(results[0].gainPLN).toBe(6_000);
    expect(results[0].taxPLN).toBe(1_140); // 19% × 6,000
  });

  it('loss scenario — no tax', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 200 })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 10, pricePerShare: 100 })];

    const { results } = matchFifo(lots, sells);
    expect(results[0].gainPLN).toBeLessThan(0);
    expect(results[0].taxPLN).toBe(0);
  });
});

// ─── Multi-ticker ─────────────────────────────────────────────────────────────

describe('matchFifo — multi-ticker', () => {
  it('matches lots per ticker independently', () => {
    const lots = [
      makeLot({ id: 'L1', ticker: 'AAPL', date: '2024-01-10', quantity: 10, pricePerShare: 100 }),
      makeLot({ id: 'L2', ticker: 'MSFT', date: '2024-01-10', quantity: 5, pricePerShare: 300 }),
    ];
    const sells = [
      makeSell({ id: 'S1', ticker: 'MSFT', date: '2024-06-15', quantity: 3, pricePerShare: 350 }),
    ];

    const { results, remainingLots } = matchFifo(lots, sells);
    expect(results).toHaveLength(1);
    expect(results[0].ticker).toBe('MSFT');
    expect(results[0].matchedLots[0].lotId).toBe('L2');
    expect(results[0].matchedLots[0].quantity).toBe(3);
    // AAPL lot untouched
    const aaplRemaining = remainingLots.find((r) => r.ticker === 'AAPL');
    expect(aaplRemaining?.remaining).toBe(10);
  });

  it('ticker matching is case-insensitive', () => {
    const lots = [makeLot({ id: 'L1', ticker: 'aapl', date: '2024-01-10', quantity: 10, pricePerShare: 100 })];
    const sells = [makeSell({ id: 'S1', ticker: 'AAPL', date: '2024-06-15', quantity: 5, pricePerShare: 150 })];

    const { results } = matchFifo(lots, sells);
    expect(results[0].matchedLots).toHaveLength(1);
    expect(results[0].unmatchedQuantity).toBe(0);
  });
});

// ─── NBP rate handling ────────────────────────────────────────────────────────

describe('matchFifo — NBP rates', () => {
  it('uses different NBP rates for buy and sell dates', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 100, nbpRate: 3.8 })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 10, pricePerShare: 100, nbpRate: 4.2 })];

    const { results } = matchFifo(lots, sells);
    // Revenue: 10 × 100 × 4.2 = 4,200
    expect(results[0].revenuePLN).toBe(4_200);
    // Cost: 10 × 100 × 3.8 = 3,800
    expect(results[0].costPLN).toBe(3_800);
    // FX gain: 400 PLN
    expect(results[0].gainPLN).toBe(400);
  });

  it('allocates broker fees proportionally', () => {
    const lots = [makeLot({ id: 'L1', date: '2024-01-10', quantity: 10, pricePerShare: 100, brokerFee: 20, nbpRate: 4.0 })];
    const sells = [makeSell({ id: 'S1', date: '2024-06-15', quantity: 5, pricePerShare: 150, brokerFee: 10, nbpRate: 4.0 })];

    const { results } = matchFifo(lots, sells);
    // Sell fee: 10 × 4.0 = 40
    // Buy fee allocated: 20 × (5/10) = 10, then 10 × 4.0 = 40
    // Cost: (5 × 100 × 4.0) + 40 + 40 = 2,080
    expect(results[0].costPLN).toBe(2_080);
    // Revenue: 5 × 150 × 4.0 = 3,000
    expect(results[0].revenuePLN).toBe(3_000);
    expect(results[0].gainPLN).toBe(920);
  });
});

// ─── Sequential sells ─────────────────────────────────────────────────────────

describe('matchFifo — sequential sells', () => {
  it('second sell continues where first left off', () => {
    const lots = [
      makeLot({ id: 'L1', date: '2024-01-10', quantity: 5, pricePerShare: 80 }),
      makeLot({ id: 'L2', date: '2024-02-20', quantity: 5, pricePerShare: 120 }),
    ];
    const sells = [
      makeSell({ id: 'S1', date: '2024-06-01', quantity: 3, pricePerShare: 150 }),
      makeSell({ id: 'S2', date: '2024-07-01', quantity: 5, pricePerShare: 160 }),
    ];

    const { results, remainingLots } = matchFifo(lots, sells);

    // S1 takes 3 from L1
    expect(results[0].matchedLots[0].lotId).toBe('L1');
    expect(results[0].matchedLots[0].quantity).toBe(3);

    // S2 takes remaining 2 from L1 + 3 from L2
    expect(results[1].matchedLots).toHaveLength(2);
    expect(results[1].matchedLots[0].lotId).toBe('L1');
    expect(results[1].matchedLots[0].quantity).toBe(2);
    expect(results[1].matchedLots[1].lotId).toBe('L2');
    expect(results[1].matchedLots[1].quantity).toBe(3);

    // 2 shares remain in L2
    expect(remainingLots).toHaveLength(1);
    expect(remainingLots[0].remaining).toBe(2);
  });
});
