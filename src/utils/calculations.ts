import type { ScenarioKey, ScenarioParams, ScenarioResult, Scenarios } from '../types/scenario';

const BELKA_TAX = 0.19;

export interface CalcInputs {
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  wibor3mPercent: number; // e.g. 5.82 for 5.82%
  horizonMonths: number;
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
  const savingsEndValuePLN = calcSavingsEndValue(inputs);
  const savingsReturnNet = ((savingsEndValuePLN - currentValuePLN) / currentValuePLN) * 100;

  const labels: Record<ScenarioKey, string> = { bear: 'Bear 🐻', base: 'Base ⚖️', bull: 'Bull 🐂' };

  return (['bear', 'base', 'bull'] as ScenarioKey[]).map((key) => {
    const { rawEndValue, netEndValue } = calcStockScenario(inputs, scenarios[key]);
    const stockBeatsSavings = netEndValue > savingsEndValuePLN;
    const differencePLN = netEndValue - savingsEndValuePLN;
    const differencePercent = (differencePLN / currentValuePLN) * 100;
    const stockReturnNet = ((netEndValue - currentValuePLN) / currentValuePLN) * 100;

    return {
      key,
      label: labels[key],
      currentValuePLN,
      stockRawEndValuePLN: rawEndValue,
      stockNetEndValuePLN: netEndValue,
      savingsEndValuePLN,
      stockBeatsSavings,
      differencePLN,
      differencePercent,
      stockReturnNet,
      savingsReturnNet,
    };
  });
}

/** Generate timeline data: for each month from 0 to horizonMonths */
export interface TimelinePoint {
  month: number;
  savings: number;
  bear: number;
  base: number;
  bull: number;
}

export function calcTimeline(inputs: CalcInputs, scenarios: Scenarios): TimelinePoint[] {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const points: TimelinePoint[] = [];

  for (let m = 0; m <= inputs.horizonMonths; m++) {
    const monthlyRate = inputs.wibor3mPercent / 100 / 12;
    const grossEnd = currentValuePLN * Math.pow(1 + monthlyRate, m);
    const savings = currentValuePLN + (grossEnd - currentValuePLN) * (1 - BELKA_TAX);

    const calcAt = (params: ScenarioParams) => {
      // Scale the scenario deltas linearly to the current month fraction
      const fraction = m / inputs.horizonMonths;
      const scaledParams: ScenarioParams = {
        deltaStock: params.deltaStock * fraction,
        deltaFx: params.deltaFx * fraction,
      };
      return calcStockScenario({ ...inputs, horizonMonths: m }, scaledParams).netEndValue;
    };

    points.push({
      month: m,
      savings,
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
  beatsSavings: boolean;
}

export function calcHeatmap(inputs: CalcInputs, range = 20, step = 4): HeatmapCell[] {
  const savingsEnd = calcSavingsEndValue(inputs);
  const cells: HeatmapCell[] = [];
  for (let ds = -range; ds <= range; ds += step) {
    for (let df = -range; df <= range; df += step) {
      const { netEndValue } = calcStockScenario(inputs, { deltaStock: ds, deltaFx: df });
      cells.push({
        deltaStock: ds,
        deltaFx: df,
        stockNetEnd: netEndValue,
        beatsSavings: netEndValue > savingsEnd,
      });
    }
  }
  return cells;
}
