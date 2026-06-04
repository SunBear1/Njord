/**
 * FIFO (First In, First Out) lot matching engine for Polish Belka tax.
 *
 * Polish tax law (Art. 30b ust. 2 ustawy o PIT) requires FIFO ordering
 * when matching buy lots to sells of the same instrument.
 *
 * This engine:
 * 1. Groups buy lots by ticker
 * 2. Sorts them by date (oldest first)
 * 3. Consumes lots FIFO when a sell occurs
 * 4. Computes PLN cost basis using each lot's own NBP rate
 */

import type { FifoLot, FifoSell, FifoSellResult, FifoMatchedLot } from '../types/tax';
import { BELKA_RATE } from '../types/accumulation';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Internal mutable copy of a lot with remaining quantity. */
interface LotState {
  lot: FifoLot;
  remaining: number;
}

/**
 * Match sells to buy lots using FIFO ordering.
 *
 * @param lots - All buy/grant lots (will not be mutated)
 * @param sells - All sell transactions (will not be mutated)
 * @returns One FifoSellResult per sell, plus the remaining unmatched inventory
 */
export function matchFifo(
  lots: readonly FifoLot[],
  sells: readonly FifoSell[],
): { results: FifoSellResult[]; remainingLots: Array<{ lotId: string; ticker: string; remaining: number }> } {
  // Build per-ticker lot queues, sorted by date (FIFO)
  const lotQueues = new Map<string, LotState[]>();
  for (const lot of lots) {
    const ticker = lot.ticker.toUpperCase();
    if (!lotQueues.has(ticker)) lotQueues.set(ticker, []);
    lotQueues.get(ticker)!.push({ lot, remaining: lot.quantity });
  }
  // Sort each queue by date ascending (oldest first = FIFO)
  for (const queue of lotQueues.values()) {
    queue.sort((a, b) => a.lot.date.localeCompare(b.lot.date));
  }

  // Sort sells by date ascending (process in chronological order)
  const sortedSells = [...sells].sort((a, b) => a.date.localeCompare(b.date));

  const results: FifoSellResult[] = [];

  for (const sell of sortedSells) {
    const ticker = sell.ticker.toUpperCase();
    const queue = lotQueues.get(ticker) ?? [];
    const sellNbpRate = sell.nbpRate ?? 0;

    let remainingToSell = sell.quantity;
    const matchedLots: FifoMatchedLot[] = [];

    for (const lotState of queue) {
      if (remainingToSell <= 0) break;
      if (lotState.remaining <= 0) continue;

      // Only consume lots dated on or before the sell date
      if (lotState.lot.date > sell.date) continue;

      const consumed = Math.min(lotState.remaining, remainingToSell);
      const fractionOfLot = lotState.lot.quantity > 0
        ? consumed / lotState.lot.quantity
        : 0;

      matchedLots.push({
        lotId: lotState.lot.id,
        quantity: consumed,
        costPerShare: lotState.lot.pricePerShare,
        buyNbpRate: lotState.lot.nbpRate ?? 0,
        buyDate: lotState.lot.date,
        zeroCost: lotState.lot.zeroCost,
        allocatedBuyFee: round2(lotState.lot.brokerFee * fractionOfLot),
      });

      lotState.remaining -= consumed;
      remainingToSell -= consumed;
    }

    // Compute PLN values
    const revenuePLN = round2(sell.quantity * sell.pricePerShare * sellNbpRate);
    const saleFeesPLN = round2(sell.brokerFee * sellNbpRate);

    let costPLN = saleFeesPLN;
    for (const m of matchedLots) {
      if (m.zeroCost) {
        // Zero-cost lots have no acquisition cost
        costPLN += round2(m.allocatedBuyFee * m.buyNbpRate);
      } else {
        costPLN += round2(
          (m.quantity * m.costPerShare + m.allocatedBuyFee) * m.buyNbpRate,
        );
      }
    }

    const gainPLN = round2(revenuePLN - costPLN);
    const taxPLN = gainPLN > 0 ? round2(gainPLN * BELKA_RATE) : 0;

    results.push({
      sellId: sell.id,
      ticker,
      sellDate: sell.date,
      revenuePLN,
      costPLN,
      gainPLN,
      taxPLN,
      matchedLots,
      unmatchedQuantity: Math.max(0, remainingToSell),
    });
  }

  // Collect remaining inventory
  const remainingLots: Array<{ lotId: string; ticker: string; remaining: number }> = [];
  for (const queue of lotQueues.values()) {
    for (const ls of queue) {
      if (ls.remaining > 0) {
        remainingLots.push({
          lotId: ls.lot.id,
          ticker: ls.lot.ticker.toUpperCase(),
          remaining: ls.remaining,
        });
      }
    }
  }

  return { results, remainingLots };
}
