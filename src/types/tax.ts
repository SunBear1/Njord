/** Tax calculation types for the standalone Belka tax calculator. */

// ─── Multi-transaction types ──────────────────────────────────────────────────

/** How the asset was originally acquired. */
export type AcquisitionMode = 'purchase' | 'grant' | 'other_zero_cost';

/**
 * A single securities sale transaction for Belka tax calculation.
 *
 * Progressive disclosure model: when `zeroCostFlag = true`, all acquisition
 * fields (`acquisitionDate`, `acquisitionCostAmount`, `acquisitionBrokerFee`,
 * `exchangeRateAcquisitionToPLN`) are ignored in calculations.
 */
export interface TaxTransaction {
  /** Auto-generated unique identifier. */
  id: string;
  tradeType: 'sale' | 'dividend';
  acquisitionMode: AcquisitionMode;
  /** When true, acquisition cost = 0 (grant, RSU, free shares). */
  zeroCostFlag: boolean;

  /** Sale date — YYYY-MM-DD. Required. */
  saleDate: string;
  /** Acquisition date — YYYY-MM-DD. Required when zeroCostFlag = false. */
  acquisitionDate?: string;

  /** Currency of the sale, ISO 4217 (e.g. 'USD', 'EUR'). */
  currency: string;
  /** Currency of the acquisition when different from sale currency (e.g. buy in PLN, sell in USD). */
  acquisitionCurrency?: string;

  /** Gross sale proceeds in the transaction currency. Required, > 0. */
  saleGrossAmount: number;
  /** Purchase cost in the transaction currency. Required when zeroCostFlag = false. */
  acquisitionCostAmount?: number;
  /** Broker commission on the sale in the transaction currency. Optional. */
  saleBrokerFee?: number;
  /** Broker commission on the purchase in the transaction currency. Optional. */
  acquisitionBrokerFee?: number;

  // NBP Table A mid rates — auto-fetched from NBP, manual override allowed.
  // Rule: rate from the last business day BEFORE the transaction date.
  /** NBP rate for the sale date (last business day before saleDate). */
  exchangeRateSaleToPLN: number | null;
  /** NBP rate for the acquisition date. Falls back to sale rate when absent. */
  exchangeRateAcquisitionToPLN?: number | null;
  /** Actual NBP effective date used for the sale rate. */
  rateSaleEffectiveDate?: string;
  /** Actual NBP effective date used for the acquisition rate. */
  rateAcquisitionEffectiveDate?: string;

  // Async state for rate auto-fetch.
  isLoadingRateSale?: boolean;
  isLoadingRateAcquisition?: boolean;
  rateSaleError?: string;
  rateAcquisitionError?: string;

  /** Optional exchange ticker symbol for identification (e.g. 'AAPL', 'NVDA'). */
  ticker?: string;
  /** Company/fund name resolved from the ticker symbol. */
  tickerName?: string;
  isLoadingTicker?: boolean;
  tickerError?: string;
  /** Whether the broker commission section is expanded in the UI. */
  showCommissions?: boolean;
  /** Name of the broker that imported this transaction (e.g. 'E*TRADE', 'XTB'). */
  importSource?: string;
  /** Optional free-text note (e.g. plan type from eTrade: 'RS', 'ESPP', 'SO'). */
  notes?: string;

  // ─── Dividend-specific fields (used when tradeType = 'dividend') ──────────
  /** Gross dividend amount in the transaction currency. */
  dividendGrossAmount?: number;
  /** Withholding tax rate applied at source (e.g. 0.15 for US 15% WHT). */
  withholdingTaxRate?: number;
  /** Withholding tax amount in the transaction currency. */
  withholdingTaxAmount?: number;
  /** Source country ISO code (e.g. 'US', 'DE', 'GB'). */
  sourceCountry?: string;
}

/** Calculated result for a single transaction. */
export interface TransactionTaxResult {
  /** Sale proceeds converted to PLN at the NBP sell rate. */
  revenuePLN: number;
  /** Total cost (acquisition + commissions) converted to PLN. */
  costPLN: number;
  /** Net gain (positive) or loss (negative) in PLN. */
  gainPLN: number;
  /**
   * Per-transaction tax estimate: max(0, gainPLN) × 19%.
   * Note: actual PIT-38 tax is calculated on the net income across all transactions.
   */
  taxEstimatePLN: number;
  isLoss: boolean;
  isZeroCost: boolean;

  // ─── Dividend-specific result fields ──────────────────────────────────────
  /** Whether this is a dividend transaction. */
  isDividend: boolean;
  /** WHT already paid at source, in PLN. */
  whtPaidPLN: number;
  /** Polish tax credit for WHT (min of whtPaidPLN and 19% of gross dividend). */
  whtCreditPLN: number;
  /** Additional Polish tax to pay (19% of gross dividend − WHT credit). */
  polishTopUpPLN: number;
}

/** Per-currency breakdown for PIT-ZG attachment (one entry = one country attachment). */
export interface PitZgCurrencyEntry {
  /** ISO 4217 currency code (e.g. 'USD', 'EUR'). */
  currency: string;
  /** Sum of PLN proceeds for this currency's transactions. */
  revenuePLN: number;
  /** Sum of PLN costs for this currency's transactions. */
  costPLN: number;
  /**
   * Dochód / Strata per currency = revenuePLN − costPLN.
   * Note: cross-country loss netting does NOT happen here — it happens in PIT-38.
   */
  incomePLN: number;
}

/** Aggregate summary across multiple transactions (PIT-38 level). */
export interface MultiTaxSummary {
  totalRevenuePLN: number;
  totalCostPLN: number;
  /** Sum of positive gains only. */
  totalGainPLN: number;
  /** Sum of losses (as a positive number). */
  totalLossPLN: number;
  /** Net income = totalGain − totalLoss (may be negative). Applies across all sources. */
  netIncomePLN: number;
  /**
   * Tax due per PIT-38: max(0, netIncomePLN) × 19%.
   * Losses from one transaction offset gains from others.
   */
  taxDuePLN: number;

  // ── Solidarity levy (danina solidarnościowa) ──────────────────────────────

  /**
   * 4% surcharge on PIT-38 income exceeding 1,000,000 PLN.
   * Reported on DSF-1. Only non-zero for very high-value portfolios.
   */
  solidarityLevyPLN: number;

  // ── PIT-38 field mapping ──────────────────────────────────────────────────

  /**
   * Maps summary values to official PIT-38 field positions (Poz.).
   * Helps users manually fill the PIT-38 form.
   */
  pit38Fields: Pit38FieldMapping;

  // ── PIT-ZG support ──────────────────────────────────────────────────────────

  /**
   * True when any ready transaction has a non-PLN currency.
   * Foreign-currency transactions (NYSE, NASDAQ via foreign brokers) require
   * the PIT-ZG attachment (one per country) filed together with PIT-38.
   */
  requiresPitZg: boolean;

  /** Revenue/cost/income from PLN-currency transactions (GPW/NewConnect — domestic). */
  domesticRevenuePLN: number;
  domesticCostPLN: number;
  /** Domestic net income = domestic gains − domestic losses (may be negative). */
  domesticIncomePLN: number;

  /** Revenue/cost/income from non-PLN-currency transactions (foreign exchanges). */
  foreignRevenuePLN: number;
  foreignCostPLN: number;
  /** Foreign net income = foreign gains − foreign losses (may be negative). */
  foreignIncomePLN: number;

  /**
   * Per-currency breakdown for PIT-ZG (one entry per distinct currency code).
   * Each entry corresponds to one PIT-ZG country attachment.
   * Sorted by revenue descending.
   *
   * Note: EUR is ambiguous (DE, NL, IE, FR…) — the user must specify the country
   * on the actual PIT-ZG form.
   */
  pitZgByCurrency: PitZgCurrencyEntry[];

  // ── Dividend summary ────────────────────────────────────────────────────────

  /** Total gross dividends in PLN. */
  totalDividendGrossPLN: number;
  /** Total WHT paid at source, in PLN. */
  totalWhtPaidPLN: number;
  /** Total WHT credit applied against Polish tax. */
  totalWhtCreditPLN: number;
  /** Total additional Polish tax to pay on dividends. */
  totalDividendTopUpPLN: number;
}

/**
 * Maps summary values to official PIT-38 field positions.
 * Based on the 2024/2025 PIT-38 form layout.
 */
export interface Pit38FieldMapping {
  /** Poz. 24 — Przychód z odpłatnego zbycia papierów wartościowych. */
  poz24_revenue: number;
  /** Poz. 25 — Koszty uzyskania przychodu. */
  poz25_costs: number;
  /** Poz. 26 — Dochód (przychód − koszty, ≥ 0). */
  poz26_income: number;
  /** Poz. 27 — Strata (koszty − przychód when costs > revenue, ≥ 0). */
  poz27_loss: number;
  /** Poz. 33 — Podstawa obliczenia podatku (po odliczeniach). */
  poz33_taxBase: number;
  /** Poz. 34 — Podatek 19%. */
  poz34_tax: number;
}

// ─── Legacy single-transaction types (kept for backward compat) ───────────────

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

// ─── FIFO lot matching types ──────────────────────────────────────────────────

/** A buy or grant lot for FIFO cost-basis matching. */
export interface FifoLot {
  id: string;
  ticker: string;
  date: string;
  /** Number of shares purchased/granted. */
  quantity: number;
  /** Per-share cost in the transaction currency. 0 for grants/RSUs. */
  pricePerShare: number;
  /** Broker fee for the purchase in the transaction currency. */
  brokerFee: number;
  currency: string;
  /** NBP Table A mid rate for the buy date. */
  nbpRate: number | null;
  /** Whether this is a zero-cost acquisition (grant, RSU). */
  zeroCost: boolean;
}

/** A sell event for FIFO matching. */
export interface FifoSell {
  id: string;
  ticker: string;
  date: string;
  /** Number of shares sold. */
  quantity: number;
  /** Per-share sale price in the transaction currency. */
  pricePerShare: number;
  /** Broker fee for the sale in the transaction currency. */
  brokerFee: number;
  currency: string;
  /** NBP Table A mid rate for the sell date. */
  nbpRate: number | null;
}

/** A single lot consumed by a FIFO sell match. */
export interface FifoMatchedLot {
  lotId: string;
  /** Shares consumed from this lot. */
  quantity: number;
  /** Per-share cost from the original lot. */
  costPerShare: number;
  /** NBP rate from the original lot buy date. */
  buyNbpRate: number;
  buyDate: string;
  zeroCost: boolean;
  /** Proportional buy broker fee allocated to this match. */
  allocatedBuyFee: number;
}

/** Result of FIFO-matching a single sell against available lots. */
export interface FifoSellResult {
  sellId: string;
  ticker: string;
  sellDate: string;
  /** Revenue in PLN (quantity × pricePerShare × sellNbpRate). */
  revenuePLN: number;
  /** Cost basis in PLN (sum of matched lot costs × their buyNbpRates). */
  costPLN: number;
  gainPLN: number;
  taxPLN: number;
  /** Lots consumed by this sell (may span multiple buy lots). */
  matchedLots: FifoMatchedLot[];
  /** Shares that could not be matched to any buy lot. */
  unmatchedQuantity: number;
}
