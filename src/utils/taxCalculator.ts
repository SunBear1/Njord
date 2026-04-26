/**
 * Polish Belka tax (19% capital gains tax) calculation engine.
 */

import type { TaxInputs, TaxResult, TaxTransaction, TransactionTaxResult, MultiTaxSummary, Pit38FieldMapping } from '../types/tax';
import { BELKA_RATE } from '../types/accumulation';

const BELKA_TAX = BELKA_RATE;

/** Solidarity levy threshold — 4% surcharge on PIT-38 income above 1M PLN. */
const SOLIDARITY_THRESHOLD = 1_000_000;
const SOLIDARITY_RATE = 0.04;

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
  // ── Dividend path ───────────────────────────────────────────────────────────
  if (tx.tradeType === 'dividend') {
    return calcDividendResult(tx);
  }

  // ── Sale path ───────────────────────────────────────────────────────────────
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
    isDividend: false,
    whtPaidPLN: 0,
    whtCreditPLN: 0,
    polishTopUpPLN: 0,
  };
}

/**
 * Calculates tax result for a dividend transaction.
 *
 * Polish tax law: 19% Belka on gross dividends, minus WHT credit.
 * US-Poland treaty: 15% US WHT is credited against 19% Polish tax → 4% top-up.
 */
function calcDividendResult(tx: TaxTransaction): TransactionTaxResult | null {
  const rate = tx.exchangeRateSaleToPLN;
  if (rate === null || rate === undefined || rate <= 0) return null;

  const grossAmount = tx.dividendGrossAmount ?? 0;
  if (grossAmount <= 0) return null;

  const grossPLN = round2(grossAmount * rate);
  const whtRate = tx.withholdingTaxRate ?? 0;
  const whtAmountForeign = tx.withholdingTaxAmount ?? round2(grossAmount * whtRate);
  const whtPaidPLN = round2(whtAmountForeign * rate);

  // Polish tax on dividends: 19% of gross
  const polishFullTax = round2(grossPLN * BELKA_TAX);

  // WHT credit: min of WHT paid and full Polish tax (can't exceed 19%)
  const whtCreditPLN = round2(Math.min(whtPaidPLN, polishFullTax));

  // Top-up = remaining Polish tax after crediting WHT
  const polishTopUpPLN = round2(Math.max(0, polishFullTax - whtCreditPLN));

  return {
    revenuePLN: grossPLN,
    costPLN: 0,
    gainPLN: grossPLN,
    taxEstimatePLN: polishTopUpPLN,
    isLoss: false,
    isZeroCost: false,
    isDividend: true,
    whtPaidPLN,
    whtCreditPLN,
    polishTopUpPLN,
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

  // Dividend aggregates
  let totalDividendGrossPLN = 0;
  let totalWhtPaidPLN = 0;
  let totalWhtCreditPLN = 0;
  let totalDividendTopUpPLN = 0;

  // currency → { revenuePLN, costPLN } accumulators for PIT-ZG
  const currencyMap = new Map<string, { revenuePLN: number; costPLN: number }>();

  for (const tx of transactions) {
    const result = calcTransactionResult(tx);
    if (!result) continue;

    // Dividend transactions are tracked separately
    if (result.isDividend) {
      totalDividendGrossPLN += result.revenuePLN;
      totalWhtPaidPLN += result.whtPaidPLN;
      totalWhtCreditPLN += result.whtCreditPLN;
      totalDividendTopUpPLN += result.polishTopUpPLN;

      // Dividends also contribute to revenue/gain aggregates for PIT-38
      totalRevenuePLN += result.revenuePLN;
      totalGainPLN += result.gainPLN;
    } else {
      totalRevenuePLN += result.revenuePLN;
      totalCostPLN += result.costPLN;
      if (result.gainPLN > 0) {
        totalGainPLN += result.gainPLN;
      } else {
        totalLossPLN += -result.gainPLN;
      }
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

  // Solidarity levy: 4% on income exceeding 1M PLN (DSF-1 form)
  const solidarityLevyPLN = netIncomePLN > SOLIDARITY_THRESHOLD
    ? round2((netIncomePLN - SOLIDARITY_THRESHOLD) * SOLIDARITY_RATE)
    : 0;

  // PIT-38 field mapping
  const pit38Fields: Pit38FieldMapping = buildPit38Fields(
    round2(totalRevenuePLN),
    round2(totalCostPLN),
    netIncomePLN,
    taxDuePLN,
  );

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
    solidarityLevyPLN,
    pit38Fields,
    requiresPitZg: currencyMap.size > 0,
    domesticRevenuePLN: round2(domesticRevenuePLN),
    domesticCostPLN: round2(domesticCostPLN),
    domesticIncomePLN,
    foreignRevenuePLN: round2(foreignRevenuePLN),
    foreignCostPLN: round2(foreignCostPLN),
    foreignIncomePLN,
    pitZgByCurrency,
    totalDividendGrossPLN: round2(totalDividendGrossPLN),
    totalWhtPaidPLN: round2(totalWhtPaidPLN),
    totalWhtCreditPLN: round2(totalWhtCreditPLN),
    totalDividendTopUpPLN: round2(totalDividendTopUpPLN),
  };
}

// ─── PIT-38 field mapping ─────────────────────────────────────────────────────

/**
 * Maps computed summary to official PIT-38 field positions (Poz.).
 * Based on the 2024/2025 PIT-38 form layout (section E).
 */
function buildPit38Fields(
  totalRevenue: number,
  totalCost: number,
  netIncome: number,
  taxDue: number,
): Pit38FieldMapping {
  return {
    poz24_revenue: totalRevenue,
    poz25_costs: totalCost,
    poz26_income: netIncome >= 0 ? netIncome : 0,
    poz27_loss: netIncome < 0 ? round2(-netIncome) : 0,
    poz33_taxBase: netIncome > 0 ? netIncome : 0,
    poz34_tax: taxDue,
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
