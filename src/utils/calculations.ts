import type { ScenarioKey, ScenarioParams, ScenarioResult, Scenarios, BenchmarkType } from '../types/scenario';

const BELKA_TAX = 0.19;

interface CalcInputs {
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number; // Kantor rate for actual PLN conversion
  nbpMidRate: number;    // NBP Table A mid rate for Belka tax basis
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
  // Cost basis for accurate Belka tax (optional — if 0, falls back to current price)
  avgCostUSD: number;    // average purchase price per share in USD (0 = not set)
  // Transaction costs (optional — subtracted from end value before tax)
  brokerFeeUSD: number;  // total broker commission in USD (0 = none)
  // Dividend yield (optional — accumulated as net cash over horizon)
  dividendYieldPercent: number; // annual dividend yield % (0 = none)
  // ETF benchmark fields (only used when benchmarkType === 'etf')
  etfAnnualReturnPercent: number; // expected annual return % before TER (e.g. 8 for 8%)
  etfTerPercent: number;          // total expense ratio % per year (e.g. 0.07 for 0.07%)
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
    // Monthly compounding for both full and partial years
    value *= Math.pow(1 + rate / 12, monthsThisYear);
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
  if (couponFrequency <= 0) return principal;
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

function calcEtfEndValue(inputs: CalcInputs): number {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const netAnnualRate = Math.max((inputs.etfAnnualReturnPercent - inputs.etfTerPercent) / 100, -1);
  const months = inputs.horizonMonths;
  const grossEndValue = currentValuePLN * Math.pow(1 + netAnnualRate, months / 12);
  const gain = grossEndValue - currentValuePLN;
  return gain > 0
    ? currentValuePLN + gain * (1 - BELKA_TAX)
    : grossEndValue;
}

function calcBenchmarkEndValue(inputs: CalcInputs): number {
  if (inputs.benchmarkType === 'bonds') return calcBondEndValue(inputs);
  if (inputs.benchmarkType === 'etf') return calcEtfEndValue(inputs);
  return calcSavingsEndValue(inputs);
}

function benchmarkLabel(type: BenchmarkType): string {
  if (type === 'bonds') return 'Obligacje';
  if (type === 'etf') return 'ETF';
  return 'Konto';
}

function calcStockScenario(
  inputs: CalcInputs,
  params: ScenarioParams,
): { rawEndValue: number; netEndValue: number; dividendsNetPLN: number } {
  const projectedPriceUSD = inputs.currentPriceUSD * (1 + params.deltaStock / 100);
  const projectedFxRate = inputs.currentFxRate * (1 + params.deltaFx / 100);
  // Actual PLN received at kantor conversion rate, minus broker fee converted at same rate
  const feeInPLN = (inputs.brokerFeeUSD || 0) * projectedFxRate;
  const rawCapitalPLN = inputs.shares * projectedPriceUSD * projectedFxRate - feeInPLN;

  // Tax basis at NBP mid rate (Polish tax law)
  const nbpRate = inputs.nbpMidRate || inputs.currentFxRate;
  const projectedNbpRate = nbpRate * (1 + params.deltaFx / 100);
  const endValueNbp = inputs.shares * projectedPriceUSD * projectedNbpRate;
  // Fee also reduces taxable income (deductible cost of sale)
  const feeNbp = (inputs.brokerFeeUSD || 0) * projectedNbpRate;

  // Cost basis: use purchase price if provided, otherwise fall back to current price
  const costBasisNbp = inputs.avgCostUSD > 0
    ? inputs.shares * inputs.avgCostUSD * nbpRate  // use current NBP rate as proxy for purchase rate
    : inputs.shares * inputs.currentPriceUSD * nbpRate;

  const taxableCapGain = endValueNbp - feeNbp - costBasisNbp;
  const capitalGainTax = taxableCapGain > 0 ? taxableCapGain * BELKA_TAX : 0;

  // Dividends: accumulated over horizon, taxed 19% total (covers US WHT 15% + Polish 4%)
  // Based on current price as proxy for average value during the period
  const grossDividendsPLN = inputs.dividendYieldPercent > 0
    ? inputs.shares * inputs.currentPriceUSD * (inputs.dividendYieldPercent / 100) * (inputs.horizonMonths / 12) * projectedFxRate
    : 0;
  const dividendsNetPLN = grossDividendsPLN * (1 - BELKA_TAX);

  const rawEndValue = rawCapitalPLN + grossDividendsPLN;
  const netEndValue = rawCapitalPLN - capitalGainTax + dividendsNetPLN;

  return { rawEndValue, netEndValue, dividendsNetPLN };
}

export function calcAllScenarios(inputs: CalcInputs, scenarios: Scenarios): ScenarioResult[] {
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const bmEndValue = calcBenchmarkEndValue(inputs);
  const bmReturn = ((bmEndValue - currentValuePLN) / currentValuePLN) * 100;
  const bmLabel = benchmarkLabel(inputs.benchmarkType);

  // Cumulative inflation over the horizon (compound)
  const years = inputs.horizonMonths / 12;
  const inflationTotalPercent = (Math.pow(1 + inputs.inflationRate / 100, years) - 1) * 100;

  // Cost basis metrics (computed once, shared across all scenario results)
  const nbpRate = inputs.nbpMidRate || inputs.currentFxRate;
  const costBasisValuePLN = inputs.avgCostUSD > 0
    ? inputs.shares * inputs.avgCostUSD * nbpRate
    : currentValuePLN; // fallback: current value → no unrealized gain/loss
  const unrealizedGainPLN = inputs.avgCostUSD > 0
    ? currentValuePLN - costBasisValuePLN
    : 0;
  const unrealizedGainPercent = inputs.avgCostUSD > 0 && costBasisValuePLN > 0
    ? (unrealizedGainPLN / costBasisValuePLN) * 100
    : 0;

  const labels: Record<ScenarioKey, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

  return (['bear', 'base', 'bull'] as ScenarioKey[]).map((key) => {
    const { rawEndValue, netEndValue, dividendsNetPLN } = calcStockScenario(inputs, scenarios[key]);
    const stockBeatsBenchmark = netEndValue > bmEndValue;
    const differencePLN = netEndValue - bmEndValue;
    const differencePercent = (differencePLN / currentValuePLN) * 100;
    const stockReturnNet = ((netEndValue - currentValuePLN) / currentValuePLN) * 100;

    // Real returns: Fisher approximation for small values, exact for larger
    const stockRealReturnNet = ((1 + stockReturnNet / 100) / (1 + inflationTotalPercent / 100) - 1) * 100;
    const benchmarkRealReturnNet = ((1 + bmReturn / 100) / (1 + inflationTotalPercent / 100) - 1) * 100;

    // Whether Belka applies to this scenario — true only if scenario end value > cost basis
    const projectedPriceUSD = inputs.currentPriceUSD * (1 + scenarios[key].deltaStock / 100);
    const projectedNbpRate = nbpRate * (1 + scenarios[key].deltaFx / 100);
    const endValueNbp = inputs.shares * projectedPriceUSD * projectedNbpRate;
    const belkaTaxedFromCostBasis = inputs.avgCostUSD > 0
      ? endValueNbp > costBasisValuePLN
      : endValueNbp > currentValuePLN;

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
      costBasisValuePLN,
      unrealizedGainPLN,
      unrealizedGainPercent,
      belkaTaxedFromCostBasis,
      dividendsNetPLN,
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
  if (inputs.horizonMonths <= 0) return [];
  const currentValuePLN = calcCurrentValuePLN(inputs);
  const points: TimelinePoint[] = [];

  for (let m = 0; m <= inputs.horizonMonths; m++) {
    // Benchmark at month m
    const bmInputs = { ...inputs, horizonMonths: m };
    let benchmarkVal: number;
    if (inputs.benchmarkType === 'bonds') {
      const penalty = currentValuePLN * (inputs.bondPenaltyPercent / 100);

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
    } else if (inputs.benchmarkType === 'etf') {
      benchmarkVal = calcEtfEndValue(bmInputs);
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
