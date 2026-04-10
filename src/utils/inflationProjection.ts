/**
 * Inflation projection using exponential mean-reversion to NBP target.
 *
 * Model: rate(t) = target + (r₀ - target) × e^(-t/τ)
 * - target = 2.5% (NBP official inflation target)
 * - τ = 18 months (half-life ≈ 12 months)
 * - r₀ = current observed annual inflation rate
 *
 * The blended effective annual rate is the geometric mean of monthly rates
 * over the horizon, giving a single annualized figure suitable for
 * compounding: (1 + blended)^years = cumulative inflation factor.
 */

/** NBP official inflation target for Poland */
export const NBP_TARGET = 2.5;

/** Mean-reversion time constant in months (half-life ≈ 12 months → τ = 12/ln2 ≈ 17.3) */
const INFLATION_TAU = 18;

/**
 * Long-run equilibrium for savings account rates in Poland.
 * Savings accounts typically offer ~65% of the NBP reference rate.
 * With a long-run neutral NBP rate of ~4-4.5%, equilibrium ≈ 3.0%.
 */
const SAVINGS_RATE_EQUILIBRIUM = 3.0;

/** Mean-reversion time constant for savings rates — slower than inflation (τ = 24 months) */
const SAVINGS_TAU = 24;

/**
 * Projected annual inflation rate at month t from now.
 * Uses exponential decay toward NBP target.
 */
function projectedRate(currentRate: number, monthsFromNow: number): number {
  return NBP_TARGET + (currentRate - NBP_TARGET) * Math.exp(-monthsFromNow / INFLATION_TAU);
}

/**
 * Compute a blended effective annual inflation rate for the given horizon.
 *
 * This is the single annual rate that, when compounded over the horizon,
 * produces the same cumulative inflation as the month-by-month projection.
 *
 * @param currentRate  Latest observed annual inflation rate (%)
 * @param horizonMonths  Investment horizon in months
 * @returns Blended effective annual rate (%), suitable for (1+r)^years compounding
 */
export function blendedInflationRate(currentRate: number, horizonMonths: number): number {
  if (horizonMonths <= 0) return currentRate;

  // Compute cumulative inflation factor month by month
  let cumulativeFactor = 1;
  for (let m = 1; m <= horizonMonths; m++) {
    const annualRate = projectedRate(currentRate, m);
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    cumulativeFactor *= 1 + monthlyRate;
  }

  // Convert back to effective annual rate
  const years = horizonMonths / 12;
  const effectiveAnnual = (Math.pow(cumulativeFactor, 1 / years) - 1) * 100;

  return effectiveAnnual;
}

/**
 * Compute a blended effective annual savings rate for the given horizon.
 *
 * Savings account rates follow the NBP reference rate, which reverts to a
 * long-run neutral level over time. The blended rate is the single annual rate
 * that, when compounded monthly for the horizon, gives the same terminal value
 * as a month-by-month variable rate path.
 *
 * @param currentRate  Current annual savings account rate (%)
 * @param horizonMonths  Investment horizon in months
 * @returns Blended effective annual rate (%), suitable for monthly compounding
 */
export function blendedSavingsRate(currentRate: number, horizonMonths: number): number {
  if (horizonMonths <= 0) return currentRate;

  // Compute cumulative growth month by month with decaying rate
  let cumulativeGrowth = 1;
  for (let m = 1; m <= horizonMonths; m++) {
    const annualRate = SAVINGS_RATE_EQUILIBRIUM + (currentRate - SAVINGS_RATE_EQUILIBRIUM) * Math.exp(-m / SAVINGS_TAU);
    cumulativeGrowth *= 1 + annualRate / 100 / 12;
  }

  // Extract the equivalent constant annual rate (monthly compounding)
  const effectiveMonthlyRate = Math.pow(cumulativeGrowth, 1 / horizonMonths) - 1;
  return effectiveMonthlyRate * 12 * 100;
}
