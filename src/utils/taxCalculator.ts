/**
 * Polish Belka tax (19% capital gains tax) calculation engine.
 *
 * Known limitations are documented in TAX_LIMITATIONS.md at the repo root.
 */

import type { TaxInputs, TaxResult, TaxTransaction, TransactionTaxResult, MultiTaxSummary } from '../types/tax';

const BELKA_TAX = 0.19;

/** Round to grosze (2 decimal places) — required for PIT-38 PLN amounts. */
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Multi-transaction functions ──────────────────────────────────────────────

/**
 * Calculates the tax result for a single `TaxTransaction`.
 *
 * Exchange rates must already be populated on the transaction object.
 * Returns null if required rates are missing (transaction not yet ready).
 */
export function calcTransactionResult(tx: TaxTransaction): TransactionTaxResult | null {
  const sellRate = tx.exchangeRateSaleToPLN;
  if (sellRate === null || sellRate === undefined || sellRate <= 0) return null;

  // Require acquisition rate when not zero-cost — without it we can't compute a meaningful result.
  const buyRate = tx.zeroCostFlag
    ? sellRate
    : tx.exchangeRateAcquisitionToPLN ?? null;
  if (!tx.zeroCostFlag && (buyRate === null || buyRate <= 0)) return null;

  const revenuePLN = round2(tx.saleGrossAmount * sellRate);

  let costPLN: number;
  if (tx.zeroCostFlag) {
    // Grant / RSU — only sale commission is a deductible cost.
    costPLN = round2((tx.saleBrokerFee ?? 0) * sellRate);
  } else {
    const acquisitionCost = tx.acquisitionCostAmount ?? 0;
    const acquisitionFee = tx.acquisitionBrokerFee ?? 0;
    const saleFee = tx.saleBrokerFee ?? 0;
    costPLN = round2(
      (acquisitionCost + acquisitionFee) * buyRate! +
      saleFee * sellRate,
    );
  }

  const gainPLN = round2(revenuePLN - costPLN);
  const taxEstimatePLN = gainPLN > 0 ? round2(gainPLN * BELKA_TAX) : 0;

  return {
    revenuePLN,
    costPLN,
    gainPLN,
    taxEstimatePLN,
    isLoss: gainPLN < 0,
    isZeroCost: tx.zeroCostFlag,
  };
}

/**
 * Aggregates results across multiple transactions.
 *
 * Per PIT-38 rules: losses in one transaction offset gains in others.
 * Only transactions with fully populated exchange rates are included.
 *
 * Also computes domestic/foreign split and per-currency PIT-ZG breakdown:
 * - currency === 'PLN' → domestic (GPW/NewConnect)
 * - currency !== 'PLN' → foreign source (requires PIT-ZG attachment)
 */
export function calcMultiTaxSummary(transactions: TaxTransaction[]): MultiTaxSummary {
  let totalRevenuePLN = 0;
  let totalCostPLN = 0;
  let totalGainPLN = 0;
  let totalLossPLN = 0;

  let domesticRevenuePLN = 0;
  let domesticCostPLN = 0;
  let foreignRevenuePLN = 0;
  let foreignCostPLN = 0;

  // currency → { revenuePLN, costPLN } accumulators for PIT-ZG
  const currencyMap = new Map<string, { revenuePLN: number; costPLN: number }>();

  for (const tx of transactions) {
    const result = calcTransactionResult(tx);
    if (!result) continue;

    totalRevenuePLN += result.revenuePLN;
    totalCostPLN += result.costPLN;
    if (result.gainPLN > 0) {
      totalGainPLN += result.gainPLN;
    } else {
      totalLossPLN += -result.gainPLN;
    }

    const isForeign = tx.currency !== 'PLN';
    if (isForeign) {
      foreignRevenuePLN += result.revenuePLN;
      foreignCostPLN += result.costPLN;

      const entry = currencyMap.get(tx.currency) ?? { revenuePLN: 0, costPLN: 0 };
      entry.revenuePLN += result.revenuePLN;
      entry.costPLN += result.costPLN;
      currencyMap.set(tx.currency, entry);
    } else {
      domesticRevenuePLN += result.revenuePLN;
      domesticCostPLN += result.costPLN;
    }
  }

  const netIncomePLN = round2(totalGainPLN - totalLossPLN);
  const taxDuePLN = netIncomePLN > 0 ? round2(netIncomePLN * BELKA_TAX) : 0;

  const domesticIncomePLN = round2(domesticRevenuePLN - domesticCostPLN);
  const foreignIncomePLN = round2(foreignRevenuePLN - foreignCostPLN);

  const pitZgByCurrency = [...currencyMap.entries()]
    .map(([currency, acc]) => ({
      currency,
      revenuePLN: round2(acc.revenuePLN),
      costPLN: round2(acc.costPLN),
      incomePLN: round2(acc.revenuePLN - acc.costPLN),
    }))
    .sort((a, b) => b.revenuePLN - a.revenuePLN);

  return {
    totalRevenuePLN: round2(totalRevenuePLN),
    totalCostPLN: round2(totalCostPLN),
    totalGainPLN: round2(totalGainPLN),
    totalLossPLN: round2(totalLossPLN),
    netIncomePLN,
    taxDuePLN,
    requiresPitZg: currencyMap.size > 0,
    domesticRevenuePLN: round2(domesticRevenuePLN),
    domesticCostPLN: round2(domesticCostPLN),
    domesticIncomePLN,
    foreignRevenuePLN: round2(foreignRevenuePLN),
    foreignCostPLN: round2(foreignCostPLN),
    foreignIncomePLN,
    pitZgByCurrency,
  };
}

// ─── Legacy single-transaction function ───────────────────────────────────────

/**
 * Calculate Polish Belka tax (19% capital gains tax) for a stock sale.
 *
 * Uses the dual-rate model required by Polish tax law:
 * - NBP Table A mid rate → tax basis (revenue and cost)
 * - Kantor rate → actual PLN cash received
 *
 * Handles RSU/grant shares (totalCostBasisUSD = 0 → full proceeds taxable).
 */
export function calcBelkaTax(inputs: TaxInputs): TaxResult {
  const { totalProceedsUSD, totalCostBasisUSD, brokerFeeUSD, nbpRateSell, nbpRateBuy, kantorRate } = inputs;

  // NBP-based tax calculation (Polish tax law requirement)
  const revenueNbpPLN = totalProceedsUSD * nbpRateSell;
  const costBasisNbpPLN = totalCostBasisUSD * nbpRateBuy;
  const brokerFeeNbpPLN = brokerFeeUSD * nbpRateSell;
  const taxableGainPLN = revenueNbpPLN - costBasisNbpPLN - brokerFeeNbpPLN;
  const belkaTaxPLN = taxableGainPLN > 0 ? taxableGainPLN * BELKA_TAX : 0;

  // Kantor-based actual cash
  const grossProceedsKantorPLN = totalProceedsUSD * kantorRate;
  const brokerFeeKantorPLN = brokerFeeUSD * kantorRate;
  const netProceedsPLN = grossProceedsKantorPLN - brokerFeeKantorPLN - belkaTaxPLN;

  // Summary metrics
  const effectiveTaxRate = grossProceedsKantorPLN > 0
    ? (belkaTaxPLN / grossProceedsKantorPLN) * 100
    : 0;

  return {
    revenueNbpPLN,
    costBasisNbpPLN,
    brokerFeeNbpPLN,
    taxableGainPLN,
    belkaTaxPLN,
    grossProceedsKantorPLN,
    brokerFeeKantorPLN,
    netProceedsPLN,
    effectiveTaxRate,
    isLoss: taxableGainPLN <= 0,
    isRSU: totalCostBasisUSD === 0,
  };
}
