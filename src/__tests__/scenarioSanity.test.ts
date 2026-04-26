/**
 * Scenario sanity tests — these define the CONTRACT that any prediction engine must satisfy.
 * Written BEFORE the engine overhaul (TDD). Expected to FAIL on current engine, PASS after.
 */
import { describe, it, expect } from 'vitest';
import type { Scenarios } from '../types/scenario';

/**
 * Validate that scenarios satisfy all sanity constraints.
 * This is the core validation function — importable by the engine itself.
 */
export function validateScenarios(
  scenarios: Scenarios,
  horizonMonths: number,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  const T = horizonMonths / 12;

  const { bear, base, bull } = scenarios;

  // 1. Sign constraints
  if (bear.deltaStock >= 0) violations.push(`bear.deltaStock must be < 0, got ${bear.deltaStock.toFixed(1)}%`);
  if (bull.deltaStock <= 0) violations.push(`bull.deltaStock must be > 0, got ${bull.deltaStock.toFixed(1)}%`);

  // 2. Monotonicity: bear < base < bull
  if (bear.deltaStock >= base.deltaStock)
    violations.push(`bear (${bear.deltaStock.toFixed(1)}%) must be < base (${base.deltaStock.toFixed(1)}%)`);
  if (base.deltaStock >= bull.deltaStock)
    violations.push(`base (${base.deltaStock.toFixed(1)}%) must be < bull (${bull.deltaStock.toFixed(1)}%)`);

  // 3. Annual bounds: no scenario implies > 100% annual gain or > 80% annual loss
  const annualizedBull = Math.pow(1 + bull.deltaStock / 100, 1 / Math.max(T, 1 / 12)) - 1;
  const annualizedBear = -(1 - Math.pow(1 + bear.deltaStock / 100, 1 / Math.max(T, 1 / 12)));
  if (annualizedBull > 1.0)
    violations.push(`bull annualized return ${(annualizedBull * 100).toFixed(1)}% exceeds 100%`);
  if (annualizedBear < -0.8)
    violations.push(`bear annualized loss ${(annualizedBear * 100).toFixed(1)}% exceeds -80%`);

  // 4. Total bounds
  if (bull.deltaStock > 1000)
    violations.push(`bull total ${bull.deltaStock.toFixed(1)}% exceeds 1000% cap`);
  if (bear.deltaStock < -95)
    violations.push(`bear total ${bear.deltaStock.toFixed(1)}% exceeds -95% floor`);

  // 5. Asymmetry cap: |bull/bear| ≤ 5
  if (bear.deltaStock !== 0) {
    const ratio = Math.abs(bull.deltaStock / bear.deltaStock);
    if (ratio > 5) violations.push(`bull/bear ratio ${ratio.toFixed(1)} exceeds 5x`);
  }

  // 6. FX magnitude < stock magnitude (FX vol ~10-12%, stock vol ~15-40%)
  if (Math.abs(bull.deltaFx) > Math.abs(bull.deltaStock))
    violations.push(`bull FX (${bull.deltaFx.toFixed(1)}%) > stock (${bull.deltaStock.toFixed(1)}%)`);
  if (Math.abs(bear.deltaFx) > Math.abs(bear.deltaStock))
    violations.push(`bear FX (${bear.deltaFx.toFixed(1)}%) > stock (${bear.deltaStock.toFixed(1)}%)`);

  // 7. FX sign correlation — bear scenario FX should weaken (≤0), bull should strengthen (≥0)
  if (bear.deltaFx > 0) violations.push(`bear.deltaFx should be ≤ 0, got ${bear.deltaFx.toFixed(1)}%`);
  if (bull.deltaFx < 0) violations.push(`bull.deltaFx should be ≥ 0, got ${bull.deltaFx.toFixed(1)}%`);

  return { valid: violations.length === 0, violations };
}

// ── Test Helpers ─────────────────────────────────────────────────────────────

/** Generate synthetic daily log-returns with known parameters */
function syntheticLogReturns(
  annualMean: number,
  annualVol: number,
  days: number,
  seed: number = 42,
): number[] {
  const dailyMu = annualMean / 252;
  const dailySigma = annualVol / Math.sqrt(252);
  const returns: number[] = [];

  // Simple seeded PRNG (mulberry32)
  let s = seed;
  const rng = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Box-Muller
  for (let i = 0; i < days; i++) {
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1 || 1e-300)) * Math.cos(2 * Math.PI * u2);
    returns.push(dailyMu + dailySigma * z);
  }

  return returns;
}

// ── Scenario Sanity Tests ────────────────────────────────────────────────────

describe('Scenario sanity constraints', () => {
  // These will be used to test the FUTURE engine — for now they test the validator itself

  it('validates correct scenarios', () => {
    const good: Scenarios = {
      bear: { deltaStock: -25, deltaFx: -5 },
      base: { deltaStock: 5, deltaFx: 0 },
      bull: { deltaStock: 40, deltaFx: 5 },
    };
    const result = validateScenarios(good, 12);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects bear ≥ 0', () => {
    const bad: Scenarios = {
      bear: { deltaStock: 5, deltaFx: -5 },
      base: { deltaStock: 10, deltaFx: 0 },
      bull: { deltaStock: 40, deltaFx: 5 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('bear.deltaStock must be < 0'))).toBe(true);
  });

  it('rejects bull ≤ 0', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -25, deltaFx: -5 },
      base: { deltaStock: -10, deltaFx: 0 },
      bull: { deltaStock: -5, deltaFx: 5 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('bull.deltaStock must be > 0'))).toBe(true);
  });

  it('rejects non-monotonic scenarios', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -10, deltaFx: -5 },
      base: { deltaStock: -20, deltaFx: 0 }, // base < bear!
      bull: { deltaStock: 30, deltaFx: 5 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('must be <'))).toBe(true);
  });

  it('rejects bull > 1000% total', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -50, deltaFx: -5 },
      base: { deltaStock: 100, deltaFx: 0 },
      bull: { deltaStock: 1500, deltaFx: 5 },
    };
    const result = validateScenarios(bad, 144);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('1000%'))).toBe(true);
  });

  it('rejects bear < -95%', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -99, deltaFx: -5 },
      base: { deltaStock: 5, deltaFx: 0 },
      bull: { deltaStock: 40, deltaFx: 5 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('-95%'))).toBe(true);
  });

  it('rejects asymmetry ratio > 5', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -5, deltaFx: -1 },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: 100, deltaFx: 1 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('ratio'))).toBe(true);
  });

  it('rejects FX magnitude > stock magnitude', () => {
    const bad: Scenarios = {
      bear: { deltaStock: -10, deltaFx: -20 },
      base: { deltaStock: 5, deltaFx: 0 },
      bull: { deltaStock: 15, deltaFx: 20 },
    };
    const result = validateScenarios(bad, 12);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.includes('FX'))).toBe(true);
  });
});

// Export helper for use in other test files
export { syntheticLogReturns };
