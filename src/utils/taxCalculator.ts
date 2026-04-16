import type { TaxInputs, TaxResult } from '../types/tax';

const BELKA_TAX = 0.19;

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
