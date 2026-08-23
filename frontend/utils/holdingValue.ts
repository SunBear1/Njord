import { bondCouponEndValue, bondGrossValue } from './calculations';
import type { BondPreset } from '../types/scenario';
import type { BondHolding, SavingsHolding } from '../types/holding';

function monthsBetween(fromIso: string, toMs: number): number {
  const from = new Date(fromIso).getTime();
  const months = (toMs - from) / (1000 * 60 * 60 * 24 * 30.4375); // average month length
  return Math.max(0, months);
}

/**
 * Current value of a bond holding, from purchase date to `nowMs`.
 *
 * Simplification: for reference/inflation-rate bonds (ROR/DOR/COI/EDO/ROS/ROD),
 * the post-year-1 rate should be NBP-reference or CPI-blended + margin, but this
 * feature doesn't wire that live feed yet — `firstYearRate` is used as a flat
 * approximation for the whole holding period. Exact for fixed-rate bonds
 * (OTS/TOS, where year 2+ = year 1 by definition) and for holdings under a year old.
 */
export function calcBondHoldingCurrentValue(holding: BondHolding, preset: BondPreset, nowMs = Date.now()): number {
  const months = monthsBetween(holding.purchaseDate, nowMs);
  const effectiveRate = preset.firstYearRate; // see simplification note above
  if (preset.couponFrequency > 0) {
    return bondCouponEndValue(holding.principal, preset.firstYearRate, effectiveRate, months, preset.couponFrequency, preset.firstYearRate);
  }
  return bondGrossValue(holding.principal, preset.firstYearRate, effectiveRate, months);
}

/** Current value of a savings holding: simple compound interest from `asOfDate`. */
export function calcSavingsHoldingCurrentValue(holding: SavingsHolding, nowMs = Date.now()): number {
  const months = monthsBetween(holding.asOfDate, nowMs);
  return holding.principal * Math.pow(1 + holding.interestRatePercent / 12 / 100, months);
}
