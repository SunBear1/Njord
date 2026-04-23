/**
 * Wealth Accumulation Calculator — pure functions.
 *
 * Simulates monthly DCA into up to 3 tax-wrapper buckets (IKE, IKZE, Regular),
 * each with its own instrument (stocks or bonds) and tax treatment.
 */

import type {
  AccumulationInputs,
  AccumulationResult,
  BucketConfig,
  BucketResult,
  BucketYearSnapshot,
  CombinedYearSnapshot,
  Milestone,
} from '../types/accumulation';
import { BELKA_RATE, IKZE_RYCZALT_RATE, MILESTONES_PLN } from '../types/accumulation';

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
 * Simplified model: monthly contributions compound at the bond rate.
 * Year 1 uses firstYearRate, subsequent years use effectiveRate.
 */
function simulateBondsBucket(params: BucketSimParams): {
  snapshots: BucketYearSnapshot[];
  dividendTaxPaid: number;
} {
  const { monthlyPLN, horizonMonths, config } = params;

  let portfolioValue = 0;
  let totalContributed = 0;
  const snapshots: BucketYearSnapshot[] = [
    { year: 0, nominalValue: 0, totalContributed: 0, taxPaidDuringAccumulation: 0 },
  ];

  for (let m = 1; m <= horizonMonths; m++) {
    totalContributed += monthlyPLN;
    portfolioValue += monthlyPLN;

    // Determine the annual rate based on which year we're in
    const year = Math.ceil(m / 12);
    const annualRate = year === 1 ? config.bondFirstYearRate : config.bondEffectiveRate;
    const monthlyRate = annualRate / 100 / 12;

    // Compound entire portfolio (all accumulated contributions)
    portfolioValue *= 1 + monthlyRate;

    if (m % 12 === 0 || m === horizonMonths) {
      snapshots.push({
        year: Math.ceil(m / 12),
        nominalValue: portfolioValue,
        totalContributed,
        taxPaidDuringAccumulation: 0,
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
    // Each year's deduction is reinvested at the start of the year
    const monthsRemaining = (horizonYears - year) * 12 + 6; // mid-year approximation
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
