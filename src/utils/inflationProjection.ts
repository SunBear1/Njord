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
const TAU = 18;

/**
 * Projected annual inflation rate at month t from now.
 * Uses exponential decay toward NBP target.
 */
export function projectedRate(currentRate: number, monthsFromNow: number): number {
  return NBP_TARGET + (currentRate - NBP_TARGET) * Math.exp(-monthsFromNow / TAU);
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
 * Build a human-readable description of the inflation projection.
 */
export function inflationProjectionLabel(
  currentRate: number,
  horizonMonths: number,
  blended: number,
): string {
  const years = horizonMonths / 12;
  if (Math.abs(currentRate - NBP_TARGET) < 0.3) {
    return `${blended.toFixed(1)}% śr. rocznie (≈ cel NBP ${NBP_TARGET}%)`;
  }
  const direction = currentRate > NBP_TARGET ? '↘' : '↗';
  return `${blended.toFixed(1)}% śr. rocznie (${currentRate.toFixed(1)}% ${direction} ${NBP_TARGET}% cel NBP, ${years.toFixed(years % 1 === 0 ? 0 : 1)} l.)`;
}
