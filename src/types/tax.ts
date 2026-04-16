/** Tax calculation types for the standalone Belka tax calculator. */

export interface TaxInputs {
  /** Total sale proceeds in USD (from broker confirmation — "Proceeds"). */
  totalProceedsUSD: number;
  /** Total purchase cost in USD (from broker confirmation — "Cost Basis"). 0 for RSU/grants. */
  totalCostBasisUSD: number;
  /** Total broker commission in USD (deductible cost). 0 if none. */
  brokerFeeUSD: number;
  /** NBP Table A mid rate on the sell date (tax basis for revenue). */
  nbpRateSell: number;
  /** NBP Table A mid rate on the buy date (tax basis for cost). */
  nbpRateBuy: number;
  /** Kantor/bank rate for actual PLN conversion (what you actually receive). */
  kantorRate: number;
}

export interface TaxResult {
  // --- NBP-based tax calculation (Polish tax law) ---
  /** Gross revenue at NBP sell-date rate: totalProceedsUSD × nbpRateSell */
  revenueNbpPLN: number;
  /** Cost basis at NBP buy-date rate: totalCostBasisUSD × nbpRateBuy (0 for RSU) */
  costBasisNbpPLN: number;
  /** Broker fee at NBP sell-date rate: brokerFee × nbpRateSell (deductible) */
  brokerFeeNbpPLN: number;
  /** Taxable gain: revenue - costBasis - brokerFee (can be negative) */
  taxableGainPLN: number;
  /** Belka tax: 19% of taxableGain if positive, 0 otherwise */
  belkaTaxPLN: number;

  // --- Kantor-based actual cash ---
  /** Gross proceeds at kantor rate: totalProceedsUSD × kantorRate */
  grossProceedsKantorPLN: number;
  /** Broker fee at kantor rate: brokerFee × kantorRate */
  brokerFeeKantorPLN: number;
  /** Net proceeds: grossProceeds - brokerFee - belkaTax */
  netProceedsPLN: number;

  // --- Summary metrics ---
  /** Effective tax rate as % of gross kantor proceeds (belkaTax / grossProceeds × 100) */
  effectiveTaxRate: number;
  /** True if taxable gain ≤ 0 (no tax owed, loss can be offset in PIT-38) */
  isLoss: boolean;
  /** True if cost basis is 0 (RSU/grant shares) */
  isRSU: boolean;
}
