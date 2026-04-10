import type { ScenarioKey, ScenarioParams, ScenarioResult, Scenarios, BenchmarkType } from '../types/scenario';

const BELKA_TAX = 0.19;

export interface CalcInputs {
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  horizonMonths: number;
  // Benchmark
  benchmarkType: BenchmarkType;
  // Savings fields
  wibor3mPercent: number; // annual savings account rate (%). Historic name; WIBOR 3M ended in 2025.
  // Bond fields — variable-rate support
  bondFirstYearRate: number;  // % for first year/period
  bondEffectiveRate: number;  // % for subsequent years (pre-computed from type + inflation/ref)
  bondPenaltyPercent: number;
  bondCouponFrequency: number; // coupon payments/year: 0=capitalized at maturity, 1=annual, 12=monthly
  bondReinvestmentRate: number; // annual % for reinvesting coupon payments (typically savings rate)
  // Inflation
  inflationRate: number; // annual CPI % (e.g. 3.6 for 3.6%)
}

function calcCurrentValuePLN(inputs: CalcInputs): number {
  return inputs.shares * inputs.currentPriceUSD * inputs.currentFxRate;
}

function calcSavingsEndValue(inputs: CalcInputs): number {
  const { wibor3mPercent, horizonMonths } = inputs;
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const monthlyRate = wibor3mPercent / 100 / 12;
  const grossEndValue = currentValuePLN * Math.pow(1 + monthlyRate, horizonMonths);
  const grossInterest = grossEndValue - currentValuePLN;
  const netInterest = grossInterest * (1 - BELKA_TAX);
  return currentValuePLN + netInterest;
}

/** Year-by-year bond compounding with different first-year vs subsequent rates.
 *  Used for capitalized-at-maturity bonds: OTS, TOS, EDO, ROS, ROD. */
function bondGrossValue(principal: number, firstYearRate: number, effectiveRate: number, months: number): number {
  let value = principal;
  let remaining = months;
  let year = 1;

  while (remaining > 0) {
    const rate = (year === 1 ? firstYearRate : effectiveRate) / 100;
    const monthsThisYear = Math.min(remaining, 12);

    if (monthsThisYear === 12) {
      value *= (1 + rate);
    } else {
      // Partial year — simple interest for the remainder
      value *= (1 + rate * monthsThisYear / 12);
    }

    remaining -= monthsThisYear;
    year++;
  }

  return value;
}

/**
 * Coupon bond calculation: ROR/DOR (monthly), COI (annual).
 * Coupons are taxed at 19% per payout, then reinvested at the savings rate.
 * Principal stays flat — coupons don't compound on bond principal.
 * Returns total end value = principal + sum of reinvested net coupons.
 */
function bondCouponEndValue(
  principal: number,
  firstYearRate: number,
  effectiveRate: number,
  months: number,
  couponFrequency: number,
  reinvestmentRatePercent: number,
): number {
  const couponIntervalMonths = 12 / couponFrequency;
  const monthlyReinvRate = reinvestmentRatePercent / 100 / 12;
  let totalReinvested = 0;

  for (let m = couponIntervalMonths; m <= months; m += couponIntervalMonths) {
    const year = Math.ceil(m / 12);
    const rate = (year === 1 ? firstYearRate : effectiveRate) / 100;

    const grossCoupon = principal * rate * (couponIntervalMonths / 12);
    const netCoupon = grossCoupon * (1 - BELKA_TAX);

    // Reinvest net coupon at savings rate for remaining months
    const remainingMonths = months - m;
    const reinvestedGross = netCoupon * Math.pow(1 + monthlyReinvRate, remainingMonths);
    // Belka on reinvestment gains
    const reinvestGain = reinvestedGross - netCoupon;
    const netReinvested = netCoupon + (reinvestGain > 0 ? reinvestGain * (1 - BELKA_TAX) : reinvestGain);

    totalReinvested += netReinvested;
  }

  return principal + totalReinvested;
}

function calcBondEndValue(inputs: CalcInputs): number {
  const { bondFirstYearRate, bondEffectiveRate, bondPenaltyPercent, bondCouponFrequency, bondReinvestmentRate, horizonMonths } = inputs;
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const penalty = currentValuePLN * (bondPenaltyPercent / 100);

  if (bondCouponFrequency > 0) {
    // Coupon bond: coupons already taxed per-payout inside bondCouponEndValue
    const endValue = bondCouponEndValue(
      currentValuePLN, bondFirstYearRate, bondEffectiveRate,
      horizonMonths, bondCouponFrequency, bondReinvestmentRate,
    );
    return endValue - penalty;
  }

  // Capitalized bond: tax on total gain at end
  const grossEndValue = bondGrossValue(currentValuePLN, bondFirstYearRate, bondEffectiveRate, horizonMonths);
  const effectiveGross = grossEndValue - penalty;
  if (effectiveGross > currentValuePLN) {
    const netInterest = (effectiveGross - currentValuePLN) * (1 - BELKA_TAX);
    return currentValuePLN + netInterest;
  }
  return effectiveGross;
}

function calcBenchmarkEndValue(inputs: CalcInputs): number {
  return inputs.benchmarkType === 'bonds'
    ? calcBondEndValue(inputs)
    : calcSavingsEndValue(inputs);
}

function benchmarkLabel(type: BenchmarkType): string {
  return type === 'bonds' ? 'Obligacje' : 'Konto';
}

export function calcStockScenario(
  inputs: CalcInputs,
  params: ScenarioParams,
): { rawEndValue: number; netEndValue: number } {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const projectedPriceUSD = inputs.currentPriceUSD * (1 + params.deltaStock / 100);
  const projectedFxRate = inputs.currentFxRate * (1 + params.deltaFx / 100);
  const rawEndValue = inputs.shares * projectedPriceUSD * projectedFxRate;

  let netEndValue: number;
  if (rawEndValue > currentValuePLN) {
    const grossProfit = rawEndValue - currentValuePLN;
    const netProfit = grossProfit * (1 - BELKA_TAX);
    netEndValue = currentValuePLN + netProfit;
  } else {
    netEndValue = rawEndValue; // loss — no tax
  }

  return { rawEndValue, netEndValue };
}

export function calcAllScenarios(inputs: CalcInputs, scenarios: Scenarios): ScenarioResult[] {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const bmEndValue = calcBenchmarkEndValue(inputs);
  const bmReturn = ((bmEndValue - currentValuePLN) / currentValuePLN) * 100;
  const bmLabel = benchmarkLabel(inputs.benchmarkType);

  // Cumulative inflation over the horizon (compound)
  const years = inputs.horizonMonths / 12;
  const inflationTotalPercent = (Math.pow(1 + inputs.inflationRate / 100, years) - 1) * 100;

  const labels: Record<ScenarioKey, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

  return (['bear', 'base', 'bull'] as ScenarioKey[]).map((key) => {
    const { rawEndValue, netEndValue } = calcStockScenario(inputs, scenarios[key]);
    const stockBeatsBenchmark = netEndValue > bmEndValue;
    const differencePLN = netEndValue - bmEndValue;
    const differencePercent = (differencePLN / currentValuePLN) * 100;
    const stockReturnNet = ((netEndValue - currentValuePLN) / currentValuePLN) * 100;

    // Real returns: Fisher approximation for small values, exact for larger
    const stockRealReturnNet = ((1 + stockReturnNet / 100) / (1 + inflationTotalPercent / 100) - 1) * 100;
    const benchmarkRealReturnNet = ((1 + bmReturn / 100) / (1 + inflationTotalPercent / 100) - 1) * 100;

    return {
      key,
      label: labels[key],
      currentValuePLN,
      stockRawEndValuePLN: rawEndValue,
      stockNetEndValuePLN: netEndValue,
      benchmarkEndValuePLN: bmEndValue,
      stockBeatsBenchmark,
      differencePLN,
      differencePercent,
      stockReturnNet,
      benchmarkReturnNet: bmReturn,
      benchmarkLabel: bmLabel,
      stockRealReturnNet,
      benchmarkRealReturnNet,
      inflationTotalPercent,
    };
  });
}

/** Generate timeline data: for each month from 0 to horizonMonths */
export interface TimelinePoint {
  month: number;
  benchmark: number;
  bear: number;
  base: number;
  bull: number;
}

export function calcTimeline(inputs: CalcInputs, scenarios: Scenarios): TimelinePoint[] {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const points: TimelinePoint[] = [];

  for (let m = 0; m <= inputs.horizonMonths; m++) {
    // Benchmark at month m
    const bmInputs = { ...inputs, horizonMonths: m };
    let benchmarkVal: number;
    if (inputs.benchmarkType === 'bonds') {
      const penalty = m < inputs.horizonMonths ? currentValuePLN * (inputs.bondPenaltyPercent / 100) : 0;

      if (inputs.bondCouponFrequency > 0) {
        // Coupon bond: use coupon model (tax already handled per-coupon)
        const endValue = bondCouponEndValue(
          currentValuePLN, inputs.bondFirstYearRate, inputs.bondEffectiveRate,
          m, inputs.bondCouponFrequency, inputs.bondReinvestmentRate,
        );
        benchmarkVal = endValue - penalty;
      } else {
        // Capitalized bond: tax on total gain at end
        const grossEnd = bondGrossValue(currentValuePLN, inputs.bondFirstYearRate, inputs.bondEffectiveRate, m);
        const effectiveGross = grossEnd - penalty;
        benchmarkVal = effectiveGross > currentValuePLN
          ? currentValuePLN + (effectiveGross - currentValuePLN) * (1 - BELKA_TAX)
          : effectiveGross;
      }
    } else {
      const monthlyRate = inputs.wibor3mPercent / 100 / 12;
      const grossEnd = currentValuePLN * Math.pow(1 + monthlyRate, m);
      benchmarkVal = currentValuePLN + (grossEnd - currentValuePLN) * (1 - BELKA_TAX);
    }

    const calcAt = (params: ScenarioParams) => {
      const fraction = m / inputs.horizonMonths;
      // Geometric interpolation: stock prices follow multiplicative (log-normal) dynamics,
      // so the correct partial-horizon delta is geometric, not linear.
      const scaledParams: ScenarioParams = {
        deltaStock: (Math.pow(1 + params.deltaStock / 100, fraction) - 1) * 100,
        deltaFx:    (Math.pow(1 + params.deltaFx    / 100, fraction) - 1) * 100,
      };
      return calcStockScenario(bmInputs, scaledParams).netEndValue;
    };

    points.push({
      month: m,
      benchmark: benchmarkVal,
      bear: calcAt(scenarios.bear),
      base: calcAt(scenarios.base),
      bull: calcAt(scenarios.bull),
    });
  }

  return points;
}

/** Generate heatmap data: grid of deltaStock × deltaFx */
export interface HeatmapCell {
  deltaStock: number;
  deltaFx: number;
  stockNetEnd: number;
  beatsBenchmark: boolean;
}

export function calcHeatmap(inputs: CalcInputs, range = 20, step = 4): HeatmapCell[] {
  const bmEnd = calcBenchmarkEndValue(inputs);
  const cells: HeatmapCell[] = [];
  for (let ds = -range; ds <= range; ds += step) {
    for (let df = -range; df <= range; df += step) {
      const { netEndValue } = calcStockScenario(inputs, { deltaStock: ds, deltaFx: df });
      cells.push({
        deltaStock: ds,
        deltaFx: df,
        stockNetEnd: netEndValue,
        beatsBenchmark: netEndValue > bmEnd,
      });
    }
  }
  return cells;
}
