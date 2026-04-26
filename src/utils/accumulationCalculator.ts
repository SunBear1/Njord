/**
 * Wealth Accumulation Calculator — pure functions.
 *
 * Simulates monthly DCA into up to 3 tax-wrapper buckets (IKE, IKZE, Regular),
 * each with its own instrument (stocks or bonds) and tax treatment.
 */

import type {
  AccumulationInputs,
  AccumulationResult,
  AnnualTableRow,
  BucketConfig,
  BucketResult,
  BucketYearSnapshot,
  CombinedYearSnapshot,
  InstrumentType,
  Milestone,
} from '../types/accumulation';
import { BELKA_RATE, IKZE_RYCZALT_RATE, MILESTONES_PLN } from '../types/accumulation';
import type { PortfolioAllocation, WrapperPortfolioConfig } from '../types/portfolio';
import type { BondPreset } from '../types/scenario';

// ─── Monthly Allocation ───────────────────────────────────────────────────────

/**
 * Waterfall allocation: IKE fills first → IKZE → Regular gets overflow.
 * Returns monthly PLN per bucket (in the same order as inputs.buckets).
 */
export function allocateMonthly(
  totalMonthlyPLN: number,
  ikeAnnualLimit: number,
  ikzeAnnualLimit: number,
  buckets: readonly BucketConfig[],
): number[] {
  let remaining = totalMonthlyPLN;
  const allocations: number[] = [];

  for (const bucket of buckets) {
    if (!bucket.enabled) {
      allocations.push(0);
      continue;
    }

    if (bucket.wrapper === 'ike') {
      const ikeMonthly = Math.min(remaining, ikeAnnualLimit / 12);
      allocations.push(ikeMonthly);
      remaining -= ikeMonthly;
    } else if (bucket.wrapper === 'ikze') {
      const ikzeMonthly = Math.min(remaining, ikzeAnnualLimit / 12);
      allocations.push(ikzeMonthly);
      remaining -= ikzeMonthly;
    } else {
      // Regular: gets everything remaining
      allocations.push(remaining);
      remaining = 0;
    }
  }

  return allocations;
}

// ─── Per-Bucket DCA Simulation ────────────────────────────────────────────────

interface BucketSimParams {
  monthlyPLN: number;
  horizonMonths: number;
  config: BucketConfig;
}

/**
 * Simulate monthly DCA for a stocks-instrument bucket.
 * Returns yearly snapshots of portfolio value + total contributed.
 */
function simulateStocksBucket(params: BucketSimParams): {
  snapshots: BucketYearSnapshot[];
  dividendTaxPaid: number;
} {
  const { monthlyPLN, horizonMonths, config } = params;
  const monthlyReturn = Math.pow(1 + config.stockReturnPercent / 100, 1 / 12) - 1;
  const monthlyDivYield = config.dividendYieldPercent / 100 / 12;
  const fxMultiplier = 1 / (1 + config.fxSpreadPercent / 100);
  const taxOnDividends = config.wrapper === 'regular' ? BELKA_RATE : 0;

  let portfolioValue = 0;
  let totalContributed = 0;
  let totalDividendTax = 0;
  const snapshots: BucketYearSnapshot[] = [
    { year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 },
  ];

  for (let m = 1; m <= horizonMonths; m++) {
    // Monthly contribution: convert PLN → USD (minus kantor spread) → invest
    const investedPLN = monthlyPLN * fxMultiplier;
    totalContributed += monthlyPLN;
    portfolioValue += investedPLN;

    // Growth: portfolio appreciates by monthly stock return
    portfolioValue *= 1 + monthlyReturn;

    // Dividends: generated and reinvested (after tax for regular wrapper)
    const grossDiv = portfolioValue * monthlyDivYield;
    const divTax = grossDiv * taxOnDividends;
    totalDividendTax += divTax;
    portfolioValue += grossDiv - divTax;

    // Record yearly snapshot
    if (m % 12 === 0 || m === horizonMonths) {
      snapshots.push({
        year: Math.ceil(m / 12),
        nominalValue: portfolioValue,
        totalContributed,
        taxPaidDuringAccumulation: totalDividendTax,
      });
    }
  }

  return { snapshots, dividendTaxPaid: totalDividendTax };
}

/**
 * Simulate monthly DCA for a bonds-instrument bucket.
 *
 * Handles bond maturity events: when a batch of bonds reaches maturity,
 * gains are taxed (Belka) in regular wrappers and the proceeds are reinvested.
 * Year 1 uses firstYearRate, subsequent years use effectiveRate.
 */
function simulateBondsBucket(params: BucketSimParams): {
  snapshots: BucketYearSnapshot[];
  dividendTaxPaid: number;
} {
  const { monthlyPLN, horizonMonths, config } = params;
  const maturityMonths = config.bondMaturityMonths ?? 0;
  const isRegularWrapper = config.wrapper === 'regular';
  // Track individual monthly contribution cohorts for maturity events
  // Each cohort: { principal, value, ageMonths }
  let cohorts: { principal: number; value: number; ageMonths: number }[] = [];
  let totalContributed = 0;
  let taxPaidDuringAccumulation = 0;

  const snapshots: BucketYearSnapshot[] = [
    { year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 },
  ];

  for (let m = 1; m <= horizonMonths; m++) {
    totalContributed += monthlyPLN;
    cohorts.push({ principal: monthlyPLN, value: monthlyPLN, ageMonths: 0 });

    // Determine the annual rate for compounding
    const year = Math.ceil(m / 12);
    const annualRate = year === 1 ? config.bondFirstYearRate : config.bondEffectiveRate;
    const monthlyRate = annualRate / 100 / 12;

    // Compound all cohorts
    for (const c of cohorts) {
      c.value *= 1 + monthlyRate;
      c.ageMonths++;
    }

    // Check for maturity events (only if maturity period is set)
    if (maturityMonths > 0) {
      const matured: typeof cohorts = [];
      const remaining: typeof cohorts = [];
      for (const c of cohorts) {
        if (c.ageMonths >= maturityMonths) matured.push(c);
        else remaining.push(c);
      }

      if (matured.length > 0) {
        let reinvestAmount = 0;
        for (const c of matured) {
          const gain = Math.max(0, c.value - c.principal);
          // Belka tax on gain at maturity (regular wrapper only; IKE/IKZE are tax-deferred)
          const tax = isRegularWrapper ? gain * BELKA_RATE : 0;
          taxPaidDuringAccumulation += tax;
          reinvestAmount += c.value - tax;
        }
        // Reinvest matured proceeds as a single new cohort
        remaining.push({ principal: reinvestAmount, value: reinvestAmount, ageMonths: 0 });
        cohorts = remaining;
      }
    }

    if (m % 12 === 0 || m === horizonMonths) {
      const portfolioValue = cohorts.reduce((sum, c) => sum + c.value, 0);
      snapshots.push({
        year: Math.ceil(m / 12),
        nominalValue: portfolioValue,
        totalContributed,
        taxPaidDuringAccumulation,
      });
    }
  }

  return { snapshots, dividendTaxPaid: 0 };
}

// ─── Terminal Tax Calculation ─────────────────────────────────────────────────

/**
 * Calculate exit tax based on tax wrapper rules.
 * IKE: 0% at age 60+. IKZE: 10% flat on total. Regular: 19% on gains.
 */
function calcExitTax(
  wrapper: string,
  grossValue: number,
  totalContributed: number,
): number {
  if (wrapper === 'ike') return 0;
  if (wrapper === 'ikze') return grossValue * IKZE_RYCZALT_RATE;
  // Regular brokerage: Belka on gains only
  const gain = Math.max(0, grossValue - totalContributed);
  return gain * BELKA_RATE;
}

// ─── IKZE PIT Deduction ───────────────────────────────────────────────────────

/**
 * Calculate compounded value of IKZE PIT deductions reinvested in savings.
 *
 * Each year the PIT deduction (contribution × pitBracketRate) is reinvested
 * in a savings account. This function computes the terminal value of those
 * reinvested deductions.
 */
export function calcIkzePitDeduction(
  yearlyContribution: number,
  pitBracketRate: number,
  savingsRatePercent: number,
  horizonYears: number,
): number {
  const annualDeduction = yearlyContribution * pitBracketRate;
  const monthlyRate = savingsRatePercent / 100 / 12;

  let total = 0;
  for (let year = 1; year <= horizonYears; year++) {
    // Deduction available at start of next tax year (April filing) — approximate
    // as start of year (monthsRemaining = remaining full years × 12).
    const monthsRemaining = (horizonYears - year) * 12;
    const compounded = annualDeduction * Math.pow(1 + monthlyRate, monthsRemaining);
    // Belka on savings interest
    const gain = compounded - annualDeduction;
    const netGain = gain > 0 ? gain * (1 - BELKA_RATE) : gain;
    total += annualDeduction + netGain;
  }

  return total;
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export function detectMilestones(
  combined: CombinedYearSnapshot[],
): Milestone[] {
  const milestones: Milestone[] = [];
  const remaining = new Set<number>(MILESTONES_PLN);

  for (const snap of combined) {
    for (const threshold of [...remaining]) {
      if (snap.totalNominal >= threshold) {
        milestones.push({ threshold, year: snap.year });
        remaining.delete(threshold);
      }
    }
    if (remaining.size === 0) break;
  }

  return milestones;
}

// ─── Main Calculation ─────────────────────────────────────────────────────────

/**
 * Calculate the full accumulation result for all buckets.
 */
export function calcAccumulationResult(inputs: AccumulationInputs): AccumulationResult {
  const horizonMonths = inputs.horizonYears * 12;

  // 1. Allocate monthly contributions
  const monthlyAllocations = allocateMonthly(
    inputs.totalMonthlyPLN,
    inputs.ikeAnnualLimit,
    inputs.ikzeAnnualLimit,
    inputs.buckets,
  );

  // 2. Simulate each bucket
  const bucketResults: BucketResult[] = inputs.buckets.map((config, i) => {
    const monthlyPLN = monthlyAllocations[i];
    if (!config.enabled || monthlyPLN <= 0) {
      return {
        wrapper: config.wrapper,
        instrument: config.instrument,
        enabled: config.enabled,
        snapshots: [{ year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 }],
        monthlyPLN: 0,
        terminalGrossValue: 0,
        terminalNetValue: 0,
        totalContributed: 0,
        exitTaxPaid: 0,
        dividendTaxPaid: 0,
      };
    }

    const simParams: BucketSimParams = { monthlyPLN, horizonMonths, config };
    const sim = config.instrument === 'stocks'
      ? simulateStocksBucket(simParams)
      : simulateBondsBucket(simParams);

    const terminalGross = sim.snapshots[sim.snapshots.length - 1].nominalValue;
    const totalContributed = sim.snapshots[sim.snapshots.length - 1].totalContributed;

    // Apply exit tax based on wrapper.
    // For bonds in regular wrapper, Belka is on the bond gain (like capitalized bonds).
    const exitTax = calcExitTax(config.wrapper, terminalGross, totalContributed);

    return {
      wrapper: config.wrapper,
      instrument: config.instrument,
      enabled: config.enabled,
      snapshots: sim.snapshots,
      monthlyPLN,
      terminalGrossValue: terminalGross,
      terminalNetValue: terminalGross - exitTax,
      totalContributed,
      exitTaxPaid: exitTax,
      dividendTaxPaid: sim.dividendTaxPaid,
    };
  });

  // 3. IKZE PIT deduction reinvestment
  const ikzeBucket = bucketResults.find(b => b.wrapper === 'ikze' && b.enabled);
  const ikzePitDeductionValue = ikzeBucket
    ? calcIkzePitDeduction(
        ikzeBucket.monthlyPLN * 12,
        inputs.pitBracket / 100,
        inputs.savingsRate,
        inputs.horizonYears,
      )
    : 0;

  // 4. Build combined year-by-year snapshots
  const maxYears = inputs.horizonYears;
  const combinedSnapshots: CombinedYearSnapshot[] = [];

  for (let y = 0; y <= maxYears; y++) {
    let ikeValue = 0;
    let ikzeValue = 0;
    let regularValue = 0;
    let totalContributed = 0;

    for (const br of bucketResults) {
      const snap = br.snapshots.find(s => s.year === y) ?? br.snapshots[br.snapshots.length - 1];
      if (snap.year > y) continue;
      if (br.wrapper === 'ike') ikeValue = snap.nominalValue;
      else if (br.wrapper === 'ikze') ikzeValue = snap.nominalValue;
      else regularValue = snap.nominalValue;
      totalContributed += snap.totalContributed;
    }

    const totalNominal = ikeValue + ikzeValue + regularValue;
    const totalContributedAllBuckets = inputs.totalMonthlyPLN * y * 12;
    const inflationFactor = Math.pow(1 + inputs.inflationRate / 100, y);

    combinedSnapshots.push({
      year: y,
      totalNominal,
      totalContributed,
      inflationErodedContributions: totalContributedAllBuckets / inflationFactor,
      ikeValue,
      ikzeValue,
      regularValue,
      counterfactualValue: 0, // filled below
    });
  }

  // 5. Counterfactual: all-regular scenario
  const counterfactualResult = calcCounterfactual(inputs);
  for (let y = 0; y <= maxYears; y++) {
    const cfSnap = counterfactualResult.snapshots.find(s => s.year === y);
    if (cfSnap) {
      combinedSnapshots[y].counterfactualValue = cfSnap.nominalValue;
    }
  }

  // 6. Totals
  const totalTerminalNet = bucketResults.reduce((sum, b) => sum + b.terminalNetValue, 0) + ikzePitDeductionValue;
  const totalContributed = bucketResults.reduce((sum, b) => sum + b.totalContributed, 0);
  const totalTaxPaid = bucketResults.reduce((sum, b) => sum + b.exitTaxPaid + b.dividendTaxPaid, 0);
  const counterfactualNet = counterfactualResult.netValue;
  const taxSavings = totalTerminalNet - counterfactualNet;

  // 7. Milestones
  const milestones = detectMilestones(combinedSnapshots);

  return {
    buckets: bucketResults,
    combinedSnapshots,
    totalTerminalNet,
    totalContributed,
    totalTaxPaid,
    counterfactualNet,
    taxSavings,
    taxSavingsPercent: counterfactualNet > 0 ? (taxSavings / counterfactualNet) * 100 : 0,
    ikzePitDeductionValue,
    milestones,
  };
}

// ─── Counterfactual (All-Regular) ─────────────────────────────────────────────

interface CounterfactualResult {
  snapshots: BucketYearSnapshot[];
  netValue: number;
}

/**
 * Compute what the portfolio would look like if ALL money went to a regular
 * brokerage account (no IKE/IKZE tax benefits).
 *
 * Uses a weighted-average return from the enabled buckets' instruments,
 * proportional to their monthly allocations.
 */
function calcCounterfactual(inputs: AccumulationInputs): CounterfactualResult {
  const horizonMonths = inputs.horizonYears * 12;

  // Calculate weighted average return based on the user's actual bucket mix
  const allocations = allocateMonthly(
    inputs.totalMonthlyPLN,
    inputs.ikeAnnualLimit,
    inputs.ikzeAnnualLimit,
    inputs.buckets,
  );

  let totalAllocated = 0;
  let weightedReturn = 0;
  let weightedDivYield = 0;
  let weightedFxSpread = 0;
  let anyStocks = false;

  inputs.buckets.forEach((config, i) => {
    const alloc = allocations[i];
    if (alloc <= 0) return;
    totalAllocated += alloc;
    if (config.instrument === 'stocks') {
      weightedReturn += alloc * config.stockReturnPercent;
      weightedDivYield += alloc * config.dividendYieldPercent;
      weightedFxSpread += alloc * config.fxSpreadPercent;
      anyStocks = true;
    } else {
      // Bond return approximation: use effective rate (simpler for counterfactual)
      weightedReturn += alloc * config.bondEffectiveRate;
    }
  });

  if (totalAllocated <= 0) {
    return { snapshots: [{ year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 }], netValue: 0 };
  }

  const avgReturn = weightedReturn / totalAllocated;
  const avgDivYield = weightedDivYield / totalAllocated;
  const avgFxSpread = anyStocks ? weightedFxSpread / totalAllocated : 0;

  // Simulate as single regular-wrapper bucket
  const cfConfig: BucketConfig = {
    wrapper: 'regular',
    instrument: anyStocks ? 'stocks' : 'bonds',
    enabled: true,
    stockReturnPercent: avgReturn,
    dividendYieldPercent: avgDivYield,
    fxSpreadPercent: avgFxSpread,
    bondPresetId: '',
    bondFirstYearRate: avgReturn,
    bondEffectiveRate: avgReturn,
    bondRateType: 'fixed',
    bondMargin: 0,
    bondCouponFrequency: 0,
    ticker: undefined,
  };

  const sim = anyStocks
    ? simulateStocksBucket({ monthlyPLN: inputs.totalMonthlyPLN, horizonMonths, config: cfConfig })
    : simulateBondsBucket({ monthlyPLN: inputs.totalMonthlyPLN, horizonMonths, config: cfConfig });

  const terminalGross = sim.snapshots[sim.snapshots.length - 1].nominalValue;
  const totalContributed = sim.snapshots[sim.snapshots.length - 1].totalContributed;
  const exitTax = calcExitTax('regular', terminalGross, totalContributed);

  return {
    snapshots: sim.snapshots,
    netValue: terminalGross - exitTax,
  };
}

// ─── Savings Bucket Simulation ────────────────────────────────────────────────

interface SavingsBucketParams extends BucketSimParams {
  savingsRatePercent: number;
}

/**
 * Simulate a savings-account bucket (simple compound interest + Belka on regular wrapper).
 */
export function simulateSavingsBucket(params: SavingsBucketParams): {
  snapshots: BucketYearSnapshot[];
  dividendTaxPaid: number;
} {
  const { monthlyPLN, horizonMonths, savingsRatePercent } = params;
  const monthlyRate = savingsRatePercent / 100 / 12;
  const isRegular = params.config.wrapper === 'regular';

  let balance = 0;
  let totalContributed = 0;
  let taxPaid = 0;
  const snapshots: BucketYearSnapshot[] = [
    { year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 },
  ];

  for (let m = 1; m <= horizonMonths; m++) {
    totalContributed += monthlyPLN;
    const interest = balance * monthlyRate;

    if (isRegular && interest > 0) {
      const belka = interest * BELKA_RATE;
      taxPaid += belka;
      balance += monthlyPLN + interest - belka;
    } else {
      balance += monthlyPLN + interest;
    }

    if (m % 12 === 0) {
      snapshots.push({
        year: m / 12,
        nominalValue: balance,
        totalContributed,
        taxPaidDuringAccumulation: taxPaid,
      });
    }
  }

  if (horizonMonths % 12 !== 0) {
    snapshots.push({
      year: Math.ceil(horizonMonths / 12),
      nominalValue: balance,
      totalContributed,
      taxPaidDuringAccumulation: taxPaid,
    });
  }

  return { snapshots, dividendTaxPaid: 0 };
}

// ─── Weighted Return ──────────────────────────────────────────────────────────

/**
 * Compute weighted average return from portfolio allocations.
 */
export function calcWeightedReturn(allocations: PortfolioAllocation[]): number {
  if (allocations.length === 0) return 0;
  const totalAlloc = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);
  if (totalAlloc <= 0) return 0;
  return allocations.reduce(
    (sum, a) => sum + (a.allocationPercent / totalAlloc) * a.expectedReturnPercent,
    0,
  );
}

// ─── Annual Table Builder ─────────────────────────────────────────────────────

function buildAnnualTable(
  bucketResults: BucketResult[],
  horizonYears: number,
  ikzeYearlyContribution: number,
  pitBracketRate: number,
): AnnualTableRow[] {
  const rows: AnnualTableRow[] = [];

  const findSnapshot = (wrapper: string, year: number) => {
    const bucket = bucketResults.find(b => b.wrapper === wrapper && b.enabled);
    return bucket?.snapshots.find(s => s.year === year);
  };

  for (let y = 1; y <= horizonYears; y++) {
    const ikeSnap = findSnapshot('ike', y);
    const ikzeSnap = findSnapshot('ikze', y);
    const regSnap = findSnapshot('regular', y);

    const ikeContributed = ikeSnap?.totalContributed ?? 0;
    const ikeValue = ikeSnap?.nominalValue ?? 0;
    const ikzeContributed = ikzeSnap?.totalContributed ?? 0;
    const ikzeValue = ikzeSnap?.nominalValue ?? 0;
    const regularContributed = regSnap?.totalContributed ?? 0;
    const regularValue = regSnap?.nominalValue ?? 0;
    const totalContributed = ikeContributed + ikzeContributed + regularContributed;
    const totalValue = ikeValue + ikzeValue + regularValue;

    rows.push({
      year: y,
      ikeContributed,
      ikeValue,
      ikzeContributed,
      ikzeValue,
      ikzePitDeduction: ikzeYearlyContribution * pitBracketRate,
      regularContributed,
      regularValue,
      totalContributed,
      totalValue,
      cumulativeGain: totalValue - totalContributed,
    });
  }

  return rows;
}

// ─── Portfolio Wizard Entry Point ─────────────────────────────────────────────

/** Default NBP reference rate for reference-type bonds (2025 value). */
const NBP_REF_RATE_DEFAULT = 5.75;

const STOCK_LIKE_TYPES = new Set(['etf', 'stocks_pl', 'stocks_foreign']);

export interface PortfolioCalcResult extends AccumulationResult {
  annualTable: AnnualTableRow[];
}

export interface PortfolioCalcInputs {
  totalMonthlyPLN: number;
  horizonYears: number;
  pitBracket: number;
  inflationRate: number;
  ikeAnnualLimit: number;
  ikzeAnnualLimit: number;
  savingsRate: number;
  reinvestIkzeDeduction: boolean;
  wrapperConfigs: WrapperPortfolioConfig[];
  bondPresets: BondPreset[];
}

/** Compute bond effective rate for year 2+ based on rate type. */
function computeBondEffectiveRate(preset: BondPreset, inflationRate: number): number {
  switch (preset.rateType) {
    case 'fixed':
      return preset.firstYearRate;
    case 'reference':
      return NBP_REF_RATE_DEFAULT + preset.margin;
    case 'inflation':
      return inflationRate + preset.margin;
    default:
      return preset.firstYearRate;
  }
}

interface SubSimResult {
  snapshots: BucketYearSnapshot[];
  dividendTaxPaid: number;
  monthlyPLN: number;
}

/** Merge year-by-year snapshots from independent sub-allocation simulations. */
function mergeSubSimulations(
  subs: SubSimResult[],
  horizonMonths: number,
): SubSimResult {
  if (subs.length === 0) {
    return {
      snapshots: [{ year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 }],
      dividendTaxPaid: 0,
      monthlyPLN: 0,
    };
  }
  if (subs.length === 1) return subs[0];

  const maxYear = Math.ceil(horizonMonths / 12);
  const merged: BucketYearSnapshot[] = [];

  for (let y = 0; y <= maxYear; y++) {
    let nominalValue = 0;
    let totalContributed = 0;
    let taxPaid = 0;

    for (const sub of subs) {
      const snap = sub.snapshots.find((s) => s.year === y);
      if (snap) {
        nominalValue += snap.nominalValue;
        totalContributed += snap.totalContributed;
        taxPaid += snap.taxPaidDuringAccumulation;
      }
    }

    merged.push({ year: y, nominalValue, totalContributed, taxPaidDuringAccumulation: taxPaid });
  }

  return {
    snapshots: merged,
    dividendTaxPaid: subs.reduce((sum, s) => sum + s.dividendTaxPaid, 0),
    monthlyPLN: subs.reduce((sum, s) => sum + s.monthlyPLN, 0),
  };
}

/** Create a BucketConfig for a stock-like allocation. */
function makeStockConfig(wrapper: string, returnPercent: number): BucketConfig {
  return {
    wrapper: wrapper as BucketConfig['wrapper'],
    instrument: 'stocks',
    enabled: true,
    stockReturnPercent: returnPercent,
    dividendYieldPercent: 0,
    fxSpreadPercent: 0,
    bondPresetId: '',
    bondFirstYearRate: 0,
    bondEffectiveRate: 0,
    bondRateType: 'fixed',
    bondMargin: 0,
    bondCouponFrequency: 0,
  };
}

/** Create a BucketConfig for a bond allocation using actual preset parameters. */
function makeBondConfig(
  wrapper: string,
  alloc: PortfolioAllocation,
  bondPresets: BondPreset[],
  inflationRate: number,
): BucketConfig {
  const preset = bondPresets.find((b) => b.id === alloc.instrumentId);
  const effectiveRate = preset
    ? computeBondEffectiveRate(preset, inflationRate)
    : alloc.expectedReturnPercent;

  return {
    wrapper: wrapper as BucketConfig['wrapper'],
    instrument: 'bonds',
    enabled: true,
    stockReturnPercent: 0,
    dividendYieldPercent: 0,
    fxSpreadPercent: 0,
    bondPresetId: alloc.instrumentId,
    bondFirstYearRate: preset?.firstYearRate ?? alloc.expectedReturnPercent,
    bondEffectiveRate: effectiveRate,
    bondRateType: preset?.rateType ?? 'fixed',
    bondMargin: preset?.margin ?? 0,
    bondCouponFrequency: preset?.couponFrequency ?? 0,
    bondMaturityMonths: preset?.maturityMonths,
  };
}

/** Determine the dominant instrument type from a set of allocations. */
function dominantInstrument(allocations: PortfolioAllocation[]): InstrumentType {
  let stockWeight = 0;
  let bondWeight = 0;
  let savingsWeight = 0;
  for (const a of allocations) {
    if (STOCK_LIKE_TYPES.has(a.instrumentType)) stockWeight += a.allocationPercent;
    else if (a.instrumentType === 'bonds') bondWeight += a.allocationPercent;
    else if (a.instrumentType === 'savings') savingsWeight += a.allocationPercent;
  }
  if (stockWeight >= bondWeight && stockWeight >= savingsWeight) return 'stocks';
  return bondWeight >= savingsWeight ? 'bonds' : 'savings';
}

/**
 * Simulate each allocation within a wrapper independently, then merge.
 *
 * Each sub-allocation gets its proper simulation engine:
 * - ETF/stocks → simulateStocksBucket (growth + dividends)
 * - Bonds → simulateBondsBucket (year-1 promo rate, year-2+ effective rate)
 * - Savings → simulateSavingsBucket (compound interest + Belka on regular)
 *
 * This replaces the old weighted-average approach that destroyed per-instrument
 * tax treatment and compounding mechanics.
 */
function simulateWrapperAllocations(
  wrapperMonthly: number,
  horizonMonths: number,
  wc: WrapperPortfolioConfig,
  inputs: PortfolioCalcInputs,
): BucketResult {
  const disabledResult: BucketResult = {
    wrapper: wc.wrapper,
    instrument: dominantInstrument(wc.allocations),
    enabled: wc.enabled,
    snapshots: [{ year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 }],
    monthlyPLN: 0,
    terminalGrossValue: 0,
    terminalNetValue: 0,
    totalContributed: 0,
    exitTaxPaid: 0,
    dividendTaxPaid: 0,
  };

  if (!wc.enabled || wrapperMonthly <= 0 || wc.allocations.length === 0) {
    return disabledResult;
  }

  const totalAllocPercent = wc.allocations.reduce((s, a) => s + a.allocationPercent, 0);
  if (totalAllocPercent <= 0) return disabledResult;

  const subSims: SubSimResult[] = [];

  for (const alloc of wc.allocations) {
    const subMonthly = wrapperMonthly * (alloc.allocationPercent / totalAllocPercent);
    if (subMonthly <= 0) continue;

    if (STOCK_LIKE_TYPES.has(alloc.instrumentType)) {
      const config = makeStockConfig(wc.wrapper, alloc.expectedReturnPercent);
      const sim = simulateStocksBucket({ monthlyPLN: subMonthly, horizonMonths, config });
      subSims.push({ snapshots: sim.snapshots, dividendTaxPaid: sim.dividendTaxPaid, monthlyPLN: subMonthly });
    } else if (alloc.instrumentType === 'bonds') {
      const config = makeBondConfig(wc.wrapper, alloc, inputs.bondPresets, inputs.inflationRate);
      const sim = simulateBondsBucket({ monthlyPLN: subMonthly, horizonMonths, config });
      subSims.push({ snapshots: sim.snapshots, dividendTaxPaid: 0, monthlyPLN: subMonthly });
    } else if (alloc.instrumentType === 'savings') {
      const config = makeStockConfig(wc.wrapper, 0); // only wrapper field is read
      const sim = simulateSavingsBucket({
        monthlyPLN: subMonthly,
        horizonMonths,
        savingsRatePercent: inputs.savingsRate,
        config,
      });
      subSims.push({ snapshots: sim.snapshots, dividendTaxPaid: 0, monthlyPLN: subMonthly });
    }
  }

  const merged = mergeSubSimulations(subSims, horizonMonths);
  const terminalSnap = merged.snapshots[merged.snapshots.length - 1];
  const terminalGross = terminalSnap.nominalValue;
  const totalContributed = terminalSnap.totalContributed;
  const exitTax = calcExitTax(wc.wrapper, terminalGross, totalContributed);

  return {
    wrapper: wc.wrapper,
    instrument: dominantInstrument(wc.allocations),
    enabled: wc.enabled,
    snapshots: merged.snapshots,
    monthlyPLN: merged.monthlyPLN,
    terminalGrossValue: terminalGross,
    terminalNetValue: terminalGross - exitTax,
    totalContributed,
    exitTaxPaid: exitTax,
    dividendTaxPaid: merged.dividendTaxPaid,
  };
}

/** Counterfactual: what if ALL money went to a regular brokerage with the same instruments? */
function calcPortfolioCounterfactual(
  inputs: PortfolioCalcInputs,
  monthlyPerWrapper: number[],
  horizonMonths: number,
): { snapshots: BucketYearSnapshot[]; netValue: number } {
  let totalWeightedReturn = 0;
  let totalAllocatedMonthly = 0;

  inputs.wrapperConfigs.forEach((wc, i) => {
    const wrapperMonthly = monthlyPerWrapper[i];
    if (!wc.enabled || wrapperMonthly <= 0) return;
    const totalPct = wc.allocations.reduce((s, a) => s + a.allocationPercent, 0);
    if (totalPct <= 0) return;
    for (const alloc of wc.allocations) {
      const allocMonthly = wrapperMonthly * (alloc.allocationPercent / totalPct);
      totalWeightedReturn += allocMonthly * alloc.expectedReturnPercent;
      totalAllocatedMonthly += allocMonthly;
    }
  });

  const emptyResult = {
    snapshots: [{ year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 }],
    netValue: 0,
  };
  if (totalAllocatedMonthly <= 0) return emptyResult;

  const avgReturn = totalWeightedReturn / totalAllocatedMonthly;
  const config = makeStockConfig('regular', avgReturn);
  const sim = simulateStocksBucket({ monthlyPLN: inputs.totalMonthlyPLN, horizonMonths, config });

  const terminalGross = sim.snapshots[sim.snapshots.length - 1].nominalValue;
  const totalContributed = sim.snapshots[sim.snapshots.length - 1].totalContributed;
  const exitTax = calcExitTax('regular', terminalGross, totalContributed);

  return { snapshots: sim.snapshots, netValue: terminalGross - exitTax };
}

/**
 * Portfolio wizard entry point.
 *
 * Simulates each allocation within each wrapper independently using its
 * proper engine (stocks/bonds/savings), then merges results per wrapper.
 * This preserves per-instrument tax treatment, bond compounding mechanics,
 * and savings interest behavior.
 */
export function calcPortfolioResult(inputs: PortfolioCalcInputs): PortfolioCalcResult {
  const horizonMonths = inputs.horizonYears * 12;

  // 1. Waterfall monthly allocation: IKE → IKZE → Regular
  const dummyBuckets: BucketConfig[] = inputs.wrapperConfigs.map((wc) =>
    ({ ...makeStockConfig(wc.wrapper, 0), enabled: wc.enabled }),
  );
  const monthlyPerWrapper = allocateMonthly(
    inputs.totalMonthlyPLN,
    inputs.ikeAnnualLimit,
    inputs.ikzeAnnualLimit,
    dummyBuckets,
  );

  // 2. Simulate each wrapper's allocations independently
  const bucketResults: BucketResult[] = inputs.wrapperConfigs.map((wc, i) =>
    simulateWrapperAllocations(monthlyPerWrapper[i], horizonMonths, wc, inputs),
  );

  // 3. IKZE PIT deduction reinvestment
  const ikzeBucket = bucketResults.find((b) => b.wrapper === 'ikze' && b.enabled);
  const ikzePitDeductionValue =
    ikzeBucket && inputs.reinvestIkzeDeduction
      ? calcIkzePitDeduction(
          ikzeBucket.monthlyPLN * 12,
          inputs.pitBracket / 100,
          inputs.savingsRate,
          inputs.horizonYears,
        )
      : 0;

  // 4. Combined year-by-year snapshots
  const maxYears = inputs.horizonYears;
  const combinedSnapshots: CombinedYearSnapshot[] = [];

  for (let y = 0; y <= maxYears; y++) {
    let ikeValue = 0;
    let ikzeValue = 0;
    let regularValue = 0;
    let totalContributed = 0;

    for (const br of bucketResults) {
      const snap = br.snapshots.find((s) => s.year === y) ?? br.snapshots[br.snapshots.length - 1];
      if (snap.year > y) continue;
      if (br.wrapper === 'ike') ikeValue = snap.nominalValue;
      else if (br.wrapper === 'ikze') ikzeValue = snap.nominalValue;
      else regularValue = snap.nominalValue;
      totalContributed += snap.totalContributed;
    }

    const totalNominal = ikeValue + ikzeValue + regularValue;
    const totalContributedAllBuckets = inputs.totalMonthlyPLN * y * 12;
    const inflationFactor = Math.pow(1 + inputs.inflationRate / 100, y);

    combinedSnapshots.push({
      year: y,
      totalNominal,
      totalContributed,
      inflationErodedContributions: totalContributedAllBuckets / inflationFactor,
      ikeValue,
      ikzeValue,
      regularValue,
      counterfactualValue: 0,
    });
  }

  // 5. Counterfactual: all-regular scenario
  const cfResult = calcPortfolioCounterfactual(inputs, monthlyPerWrapper, horizonMonths);
  for (let y = 0; y <= maxYears; y++) {
    const cfSnap = cfResult.snapshots.find((s) => s.year === y);
    if (cfSnap) {
      combinedSnapshots[y].counterfactualValue = cfSnap.nominalValue;
    }
  }

  // 6. Totals
  const totalTerminalNet =
    bucketResults.reduce((sum, b) => sum + b.terminalNetValue, 0) + ikzePitDeductionValue;
  const totalContributed = bucketResults.reduce((sum, b) => sum + b.totalContributed, 0);
  const totalTaxPaid = bucketResults.reduce(
    (sum, b) => sum + b.exitTaxPaid + b.dividendTaxPaid,
    0,
  );
  const counterfactualNet = cfResult.netValue;
  const taxSavings = totalTerminalNet - counterfactualNet;

  // 7. Milestones
  const milestones = detectMilestones(combinedSnapshots);

  // 8. Annual table
  const ikzeYearlyContribution = ikzeBucket ? ikzeBucket.monthlyPLN * 12 : 0;
  const annualTable = buildAnnualTable(
    bucketResults,
    inputs.horizonYears,
    ikzeYearlyContribution,
    inputs.pitBracket / 100,
  );

  return {
    buckets: bucketResults,
    combinedSnapshots,
    totalTerminalNet,
    totalContributed,
    totalTaxPaid,
    counterfactualNet,
    taxSavings,
    taxSavingsPercent: counterfactualNet > 0 ? (taxSavings / counterfactualNet) * 100 : 0,
    ikzePitDeductionValue,
    milestones,
    annualTable,
  };
}
