import type { PortfolioAllocation } from '../types/portfolio';

export interface AllocationValidation {
  valid: boolean;
  sum: number;
  /** Difference from 100. Positive = over-allocated, negative = under. */
  delta: number;
}

/**
 * Check if allocations sum to 100% (within tolerance).
 * Tolerance handles floating-point rounding (e.g., 33.33 + 33.33 + 33.34 = 100.00).
 */
export function validateAllocations(
  allocations: readonly Pick<PortfolioAllocation, 'allocationPercent'>[],
  tolerance = 0.01,
): AllocationValidation {
  const sum = allocations.reduce((s, a) => s + a.allocationPercent, 0);
  const delta = sum - 100;
  return { valid: Math.abs(delta) <= tolerance, sum, delta };
}

/**
 * Normalize allocations so they sum to exactly 100%.
 * Proportionally scales each allocation. Returns a new array (immutable).
 * If all allocations are 0, distributes equally.
 */
export function normalizeAllocations<
  T extends Pick<PortfolioAllocation, 'allocationPercent'>,
>(allocations: readonly T[]): T[] {
  if (allocations.length === 0) return [];

  const sum = allocations.reduce((s, a) => s + a.allocationPercent, 0);

  if (sum <= 0) {
    const equal = 100 / allocations.length;
    return allocations.map((a) => ({ ...a, allocationPercent: equal }));
  }

  const factor = 100 / sum;
  return allocations.map((a) => ({
    ...a,
    allocationPercent:
      Math.round(a.allocationPercent * factor * 100) / 100,
  }));
}

/**
 * Adjust one allocation's percent and proportionally redistribute the rest.
 * Used when user drags one slider — others adjust proportionally to maintain 100% sum.
 * Returns a new array.
 */
export function adjustAllocation<
  T extends Pick<PortfolioAllocation, 'allocationPercent'>,
>(allocations: readonly T[], index: number, newPercent: number): T[] {
  if (allocations.length <= 1) {
    return allocations.map((a) => ({ ...a, allocationPercent: 100 }));
  }

  const clamped = Math.max(0, Math.min(100, newPercent));
  const remaining = 100 - clamped;

  const othersSum = allocations.reduce(
    (s, a, i) => s + (i === index ? 0 : a.allocationPercent),
    0,
  );

  return allocations.map((a, i) => {
    if (i === index) return { ...a, allocationPercent: clamped };
    if (othersSum <= 0) {
      return {
        ...a,
        allocationPercent: remaining / (allocations.length - 1),
      };
    }
    return {
      ...a,
      allocationPercent:
        Math.round(
          (a.allocationPercent / othersSum) * remaining * 100,
        ) / 100,
    };
  });
}
