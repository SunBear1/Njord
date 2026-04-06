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
  wibor3mPercent: number; // e.g. 5.82 for 5.82%
  // Bond fields — variable-rate support
  bondFirstYearRate: number;  // % for first year/period
  bondEffectiveRate: number;  // % for subsequent years (pre-computed from type + inflation/ref)
  bondPenaltyPercent: number;
}

export function calcCurrentValuePLN(inputs: CalcInputs): number {
  return inputs.shares * inputs.currentPriceUSD * inputs.currentFxRate;
}

export function calcSavingsEndValue(inputs: CalcInputs): number {
  const { wibor3mPercent, horizonMonths } = inputs;
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const monthlyRate = wibor3mPercent / 100 / 12;
  const grossEndValue = currentValuePLN * Math.pow(1 + monthlyRate, horizonMonths);
  const grossInterest = grossEndValue - currentValuePLN;
  const netInterest = grossInterest * (1 - BELKA_TAX);
  return currentValuePLN + netInterest;
}

/** Year-by-year bond compounding with different first-year vs subsequent rates */
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

export function calcBondEndValue(inputs: CalcInputs): number {
  const { bondFirstYearRate, bondEffectiveRate, bondPenaltyPercent, horizonMonths } = inputs;
  const currentValuePLN = calcCurrentValuePLN(inputs);

  const grossEndValue = bondGrossValue(currentValuePLN, bondFirstYearRate, bondEffectiveRate, horizonMonths);
  const grossInterest = grossEndValue - currentValuePLN;
  const netInterest = grossInterest * (1 - BELKA_TAX);
  const penalty = currentValuePLN * (bondPenaltyPercent / 100);

  return currentValuePLN + netInterest - penalty;
}

export function calcBenchmarkEndValue(inputs: CalcInputs): number {
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

  const labels: Record<ScenarioKey, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

  return (['bear', 'base', 'bull'] as ScenarioKey[]).map((key) => {
    const { rawEndValue, netEndValue } = calcStockScenario(inputs, scenarios[key]);
    const stockBeatsBenchmark = netEndValue > bmEndValue;
    const differencePLN = netEndValue - bmEndValue;
    const differencePercent = (differencePLN / currentValuePLN) * 100;
    const stockReturnNet = ((netEndValue - currentValuePLN) / currentValuePLN) * 100;

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
      const grossEnd = bondGrossValue(currentValuePLN, inputs.bondFirstYearRate, inputs.bondEffectiveRate, m);
      const penalty = m < inputs.horizonMonths ? currentValuePLN * (inputs.bondPenaltyPercent / 100) : 0;
      benchmarkVal = currentValuePLN + (grossEnd - currentValuePLN) * (1 - BELKA_TAX) - penalty;
    } else {
      const monthlyRate = inputs.wibor3mPercent / 100 / 12;
      const grossEnd = currentValuePLN * Math.pow(1 + monthlyRate, m);
      benchmarkVal = currentValuePLN + (grossEnd - currentValuePLN) * (1 - BELKA_TAX);
    }

    const calcAt = (params: ScenarioParams) => {
      const fraction = m / inputs.horizonMonths;
      const scaledParams: ScenarioParams = {
        deltaStock: params.deltaStock * fraction,
        deltaFx: params.deltaFx * fraction,
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
