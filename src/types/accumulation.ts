/** Types and constants for the Wealth Accumulation Planner (third tab). */

// ─── Tax Wrapper ──────────────────────────────────────────────────────────────

/** Polish tax-advantaged account types. */
export type TaxWrapper = 'ike' | 'ikze' | 'regular';

/** Investment instrument within a bucket. */
export type InstrumentType = 'stocks' | 'bonds' | 'savings';

/** PIT tax bracket (Polish progressive income tax). */
export type PitBracket = 12 | 32;

// ─── Constants ────────────────────────────────────────────────────────────────

/** IKE annual contribution limit for 2026 (3× average monthly salary). */
export const IKE_LIMIT_2026 = 24_204;

/** IKZE annual contribution limit for 2026 (1.2× average monthly salary). */
export const IKZE_LIMIT_2026 = 10_081;

/** Belka capital gains tax rate. */
export const BELKA_RATE = 0.19;

/** IKZE ryczałt (flat tax) rate on withdrawal after age 65. */
export const IKZE_RYCZALT_RATE = 0.10;

/** US withholding tax on dividends (treaty rate for Poland). */
export const US_WHT_RATE = 0.15;

/** Milestone thresholds in PLN for chart markers. */
export const MILESTONES_PLN = [100_000, 250_000, 500_000, 1_000_000, 2_000_000] as const;

// ─── Bucket Configuration ─────────────────────────────────────────────────────

export interface BucketConfig {
  wrapper: TaxWrapper;
  instrument: InstrumentType;
  enabled: boolean;

  // Stocks-specific inputs
  /** Expected annual return % for stocks (e.g. 8.0 for 8%). */
  stockReturnPercent: number;
  /** Annual dividend yield % (e.g. 1.5 for 1.5%). */
  dividendYieldPercent: number;
  /** Kantor FX spread % per conversion (e.g. 0.35 for 0.35%). */
  fxSpreadPercent: number;
  /** Optional ticker symbol for auto-calibrating return from historical data. */
  ticker?: string;

  // Bonds-specific inputs
  /** Bond preset ID (e.g. 'EDO', 'COI'). */
  bondPresetId: string;
  /** First-year bond rate % (from preset). */
  bondFirstYearRate: number;
  /** Effective rate % for years 2+ (from preset + inflation/reference rate). */
  bondEffectiveRate: number;
  /** Bond rate type for proper compounding. */
  bondRateType: 'fixed' | 'reference' | 'inflation';
  /** Margin added to base rate for years 2+. */
  bondMargin: number;
  /** Coupon frequency: 0=capitalized, 1=annual, 12=monthly. */
  bondCouponFrequency: number;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface AccumulationInputs {
  /** Total monthly investment in PLN across all buckets. */
  totalMonthlyPLN: number;
  /** Investment horizon in years. */
  horizonYears: number;
  /** Polish PIT bracket (affects IKZE deduction value). */
  pitBracket: PitBracket;
  /** Annual inflation rate % for purchasing power erosion. */
  inflationRate: number;
  /** IKE annual contribution limit in PLN. */
  ikeAnnualLimit: number;
  /** IKZE annual contribution limit in PLN. */
  ikzeAnnualLimit: number;
  /** Savings account rate % for IKZE PIT deduction reinvestment. */
  savingsRate: number;
  /** Configuration for each bucket (IKE, IKZE, Regular). */
  buckets: [BucketConfig, BucketConfig, BucketConfig];
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface BucketYearSnapshot {
  /** Year index (0 = start, 1 = end of year 1, ...). */
  year: number;
  /** Nominal portfolio value in PLN at end of year. */
  nominalValue: number;
  /** Cumulative PLN contributed to this bucket. */
  totalContributed: number;
  /** Cumulative tax paid (dividends in regular brokerage). */
  taxPaidDuringAccumulation: number;
}

export interface BucketResult {
  wrapper: TaxWrapper;
  instrument: InstrumentType;
  enabled: boolean;
  /** Year-by-year snapshots. */
  snapshots: BucketYearSnapshot[];
  /** Monthly contribution allocated to this bucket. */
  monthlyPLN: number;
  /** Terminal gross value (before exit tax). */
  terminalGrossValue: number;
  /** Terminal net value (after exit tax per wrapper rules). */
  terminalNetValue: number;
  /** Total contributed over the horizon. */
  totalContributed: number;
  /** Exit tax paid at withdrawal. */
  exitTaxPaid: number;
  /** Cumulative dividend tax paid during accumulation (regular only). */
  dividendTaxPaid: number;
}

export interface Milestone {
  /** PLN threshold crossed. */
  threshold: number;
  /** Year when threshold was first crossed. */
  year: number;
}

export interface AccumulationResult {
  /** Results for each bucket. */
  buckets: BucketResult[];
  /** Combined year-by-year total (sum of all buckets). */
  combinedSnapshots: CombinedYearSnapshot[];
  /** Total terminal net value across all buckets. */
  totalTerminalNet: number;
  /** Total contributed across all buckets. */
  totalContributed: number;
  /** Total tax paid (accumulation + exit) across all buckets. */
  totalTaxPaid: number;
  /** Counterfactual: net value if everything was in regular brokerage. */
  counterfactualNet: number;
  /** Tax savings: totalTerminalNet - counterfactualNet. */
  taxSavings: number;
  /** Tax savings as % of counterfactual. */
  taxSavingsPercent: number;
  /** IKZE PIT deduction total (compounded savings from tax rebate). */
  ikzePitDeductionValue: number;
  /** Milestones reached on the combined total. */
  milestones: Milestone[];
}

export interface CombinedYearSnapshot {
  year: number;
  /** Sum of all bucket nominal values. */
  totalNominal: number;
  /** Total contributed across all buckets. */
  totalContributed: number;
  /** Purchasing power of totalContributed after inflation erosion. */
  inflationErodedContributions: number;
  /** Per-bucket nominal values for stacked chart. */
  ikeValue: number;
  ikzeValue: number;
  regularValue: number;
  /** Counterfactual (all-regular) value at this year. */
  counterfactualValue: number;
}

// ─── Annual Table Row ─────────────────────────────────────────────────────────

/** Row for the detailed annual results table in Step 4 (Summary). */
export interface AnnualTableRow {
  year: number;
  ikeContributed: number;
  ikeValue: number;
  ikzeContributed: number;
  ikzeValue: number;
  ikzePitDeduction: number;
  regularContributed: number;
  regularValue: number;
  totalContributed: number;
  totalValue: number;
  cumulativeGain: number;
}