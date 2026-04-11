/**
 * Unit tests for src/utils/calculations.ts
 *
 * Covers all financial logic: savings, bonds (8 types), stocks, timeline,
 * heatmap. Validates Belka tax, multiplicative FX math, and monotonicity.
 */
import { describe, it, expect } from 'vitest';
import {
  calcAllScenarios,
  calcTimeline,
  calcHeatmap,
} from '../utils/calculations';
import type { Scenarios } from '../types/scenario';

const BELKA = 0.19;

// ---------------------------------------------------------------------------
// Shared base inputs — override per-test as needed
// ---------------------------------------------------------------------------

function baseInputs(overrides: Record<string, unknown> = {}) {
  return {
    shares: 10,
    currentPriceUSD: 100,
    currentFxRate: 4.0,
    nbpMidRate: 4.0,
    horizonMonths: 12,
    benchmarkType: 'savings' as const,
    wibor3mPercent: 5.0,
    bondFirstYearRate: 6.0,
    bondEffectiveRate: 6.0,
    bondPenaltyPercent: 0,
    bondCouponFrequency: 0,
    bondReinvestmentRate: 5.0,
    inflationRate: 0,
    avgCostUSD: 0,
    brokerFeeUSD: 0,
    dividendYieldPercent: 0,
    etfAnnualReturnPercent: 8,
    etfTerPercent: 0.07,
    ...overrides,
  };
}

const NEUTRAL_SCENARIOS: Scenarios = {
  bear: { deltaStock: 0, deltaFx: 0 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 0, deltaFx: 0 },
};

const SPREAD_SCENARIOS: Scenarios = {
  bear: { deltaStock: -20, deltaFx: -10 },
  base: { deltaStock: 10, deltaFx: 5 },
  bull: { deltaStock: 40, deltaFx: 15 },
};

// ---------------------------------------------------------------------------
// Savings account
// ---------------------------------------------------------------------------

describe('Savings account (calcSavingsEndValue via calcAllScenarios)', () => {
  it('computes monthly compound interest with Belka applied to interest only', () => {
    const inputs = baseInputs({ wibor3mPercent: 5.0, horizonMonths: 12 });
    const principal = 10 * 100 * 4.0; // 4000 PLN
    const monthlyRate = 0.05 / 12;
    const grossEnd = principal * Math.pow(1 + monthlyRate, 12);
    const expectedNet = principal + (grossEnd - principal) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[1].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 4);
  });

  it('returns exactly principal when rate is 0%', () => {
    const inputs = baseInputs({ wibor3mPercent: 0 });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(4000, 6);
  });

  it('never returns less than principal (positive rate)', () => {
    const inputs = baseInputs({ wibor3mPercent: 3.5, horizonMonths: 60 });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeGreaterThan(4000);
  });

  it('longer horizon compounds to more than shorter horizon', () => {
    const short = calcAllScenarios(baseInputs({ horizonMonths: 6 }), NEUTRAL_SCENARIOS);
    const long = calcAllScenarios(baseInputs({ horizonMonths: 24 }), NEUTRAL_SCENARIOS);
    expect(long[0].benchmarkEndValuePLN).toBeGreaterThan(short[0].benchmarkEndValuePLN);
  });

  it('uses exponential (not simple) compounding', () => {
    const inputs = baseInputs({ wibor3mPercent: 12.0, horizonMonths: 12 });
    const principal = 4000;
    // Simple interest: 4000 * 0.12 = 480 gross; compound is more
    const monthlyRate = 0.12 / 12;
    const grossCompound = principal * Math.pow(1 + monthlyRate, 12);
    const grossSimple = principal * (1 + 0.12);
    expect(grossCompound).toBeGreaterThan(grossSimple);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    const expectedNet = principal + (grossCompound - principal) * (1 - BELKA);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 4);
  });
});

// ---------------------------------------------------------------------------
// Bond — capitalized (OTS/TOS/EDO/ROS/ROD style: couponFrequency=0)
// ---------------------------------------------------------------------------

describe('Capitalized bond (couponFrequency=0)', () => {
  it('applies Belka to gain at redemption only', () => {
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 6.0,
      bondEffectiveRate: 6.0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 0,
      horizonMonths: 12,
    });
    const principal = 4000;
    const monthlyRate = 0.06 / 12;
    const gross = principal * Math.pow(1 + monthlyRate, 12);
    const expectedNet = principal + (gross - principal) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 3);
  });

  it('deducts penalty BEFORE computing taxable gain', () => {
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 6.0,
      bondEffectiveRate: 6.0,
      bondPenaltyPercent: 0.5,
      bondCouponFrequency: 0,
      horizonMonths: 12,
    });
    const principal = 4000;
    const monthlyRate = 0.06 / 12;
    const gross = principal * Math.pow(1 + monthlyRate, 12);
    const penalty = principal * 0.005;
    const effectiveGross = gross - penalty;
    const expectedNet = principal + (effectiveGross - principal) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 3);
  });

  it('does not apply Belka when penalty causes loss (no negative tax)', () => {
    // High penalty, short hold — effectiveGross < principal
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 6.0,
      bondEffectiveRate: 6.0,
      bondPenaltyPercent: 10, // 10% penalty, far exceeds 1-month interest
      bondCouponFrequency: 0,
      horizonMonths: 1,
    });
    const principal = 4000;
    const monthlyRate = 0.06 / 12;
    const gross = principal * Math.pow(1 + monthlyRate, 1);
    const penalty = principal * 0.10;
    const effectiveGross = gross - penalty;
    // effectiveGross < principal, so no tax should be applied
    expect(effectiveGross).toBeLessThan(principal);
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(effectiveGross, 3);
  });

  it('uses different rate for year 1 vs subsequent years', () => {
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 6.0,
      bondEffectiveRate: 8.0, // higher in year 2+
      bondPenaltyPercent: 0,
      bondCouponFrequency: 0,
      horizonMonths: 24,
    });
    // Year 1: 6% monthly compound for 12 months
    const after12 = 4000 * Math.pow(1 + 0.06 / 12, 12);
    // Year 2: 8% monthly compound for 12 months
    const after24 = after12 * Math.pow(1 + 0.08 / 12, 12);
    const expectedNet = 4000 + (after24 - 4000) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 2);
  });

  it('handles partial year correctly via monthly sub-compounding', () => {
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 6.0,
      bondEffectiveRate: 6.0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 0,
      horizonMonths: 6, // half year
    });
    const principal = 4000;
    const monthlyRate = 0.06 / 12;
    const gross = principal * Math.pow(1 + monthlyRate, 6);
    const expectedNet = principal + (gross - principal) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 4);
  });
});

// ---------------------------------------------------------------------------
// Bond — coupon (ROR/DOR monthly, COI annual)
// ---------------------------------------------------------------------------

describe('Coupon bond (couponFrequency > 0)', () => {
  it('ROR-style monthly coupon: taxes each coupon individually', () => {
    // 1 share × $100 × 4 = 400 PLN; 12-month, 5% annual, monthly coupons
    const inputs = baseInputs({
      shares: 1,
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 5.0,
      bondEffectiveRate: 5.0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 12,
      bondReinvestmentRate: 5.0,
      horizonMonths: 12,
    });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    const end = results[0].benchmarkEndValuePLN;
    // End > principal (coupons earned)
    expect(end).toBeGreaterThan(400);
    // End < equivalent capitalized bond (due to earlier tax drag on coupons)
    const capInputs = baseInputs({
      shares: 1,
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 5.0,
      bondEffectiveRate: 5.0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 0,
    });
    const capEnd = calcAllScenarios(capInputs, NEUTRAL_SCENARIOS)[0].benchmarkEndValuePLN;
    expect(end).toBeLessThan(capEnd);
  });

  it('penalty is deducted from coupon bond end value', () => {
    const noPenalty = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 5.0,
      bondEffectiveRate: 5.0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 12,
    });
    const withPenalty = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 5.0,
      bondEffectiveRate: 5.0,
      bondPenaltyPercent: 0.5,
      bondCouponFrequency: 12,
    });
    const r1 = calcAllScenarios(noPenalty, NEUTRAL_SCENARIOS)[0].benchmarkEndValuePLN;
    const r2 = calcAllScenarios(withPenalty, NEUTRAL_SCENARIOS)[0].benchmarkEndValuePLN;
    expect(r2).toBeCloseTo(r1 - 4000 * 0.005, 2);
  });

  it('annual coupon (COI-style) accumulates one coupon per year', () => {
    const inputs = baseInputs({
      benchmarkType: 'bonds' as const,
      bondFirstYearRate: 4.75,
      bondEffectiveRate: 4.75,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 1,
      bondReinvestmentRate: 0, // zero reinvestment for simplicity
      horizonMonths: 12,
    });
    const principal = 4000;
    const grossCoupon = principal * (4.75 / 100); // 1 annual coupon
    const netCoupon = grossCoupon * (1 - BELKA);
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(principal + netCoupon, 2);
  });
});

// ---------------------------------------------------------------------------
// ETF benchmark
// ---------------------------------------------------------------------------

describe('ETF benchmark', () => {
  it('deducts TER before compounding', () => {
    const inputs = baseInputs({
      benchmarkType: 'etf' as const,
      etfAnnualReturnPercent: 8.0,
      etfTerPercent: 0.07,
      horizonMonths: 12,
    });
    const principal = 4000;
    const netRate = (8.0 - 0.07) / 100;
    const grossEnd = principal * Math.pow(1 + netRate, 1);
    const expectedNet = principal + (grossEnd - principal) * (1 - BELKA);

    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 3);
  });

  it('applies Belka only to gain (not principal)', () => {
    const inputs = baseInputs({
      benchmarkType: 'etf' as const,
      etfAnnualReturnPercent: 10.0,
      etfTerPercent: 0,
      horizonMonths: 12,
    });
    const principal = 4000;
    const grossEnd = principal * 1.10;
    const expectedNet = principal + (grossEnd - principal) * (1 - BELKA);
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].benchmarkEndValuePLN).toBeCloseTo(expectedNet, 3);
  });
});

// ---------------------------------------------------------------------------
// Stock scenario — FX multiplicative math & Belka
// ---------------------------------------------------------------------------

describe('Stock scenario (calcStockScenario via calcAllScenarios)', () => {
  it('zero deltas produce current value equal to starting PLN value', () => {
    const inputs = baseInputs();
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    const currentPLN = 10 * 100 * 4.0; // 4000
    // All scenarios identical with zero deltas
    expect(results[0].currentValuePLN).toBeCloseTo(currentPLN, 6);
  });

  it('multiplicative FX and stock deltas: (1+ds)×(1+dfx), not additive', () => {
    const inputs = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
    });
    const scenarios: Scenarios = {
      bear: { deltaStock: 0, deltaFx: 0 },
      base: { deltaStock: 10, deltaFx: 10 }, // +10% each → +21% combined
      bull: { deltaStock: 0, deltaFx: 0 },
    };
    const results = calcAllScenarios(inputs, scenarios);
    const expected = 100 * 1.1 * 4.0 * 1.1; // $110 × 4.4 = 484 PLN
    // Raw end: 484; no unrealized gain (avgCostUSD=0 means cost basis = current)
    // taxable gain = endNBP - costBasisNBP
    const endNbp = 100 * 1.1 * 4.0 * 1.1; // 484
    const costNbp = 100 * 4.0; // 400
    const tax = (endNbp - costNbp) * BELKA;
    const expectedNet = expected - tax;
    expect(results[1].stockNetEndValuePLN).toBeCloseTo(expectedNet, 3);
  });

  it('Belka not applied when stock declines (no tax on losses)', () => {
    const inputs = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
    });
    const scenarios: Scenarios = {
      bear: { deltaStock: -20, deltaFx: 0 },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: 0, deltaFx: 0 },
    };
    const results = calcAllScenarios(inputs, scenarios);
    // No tax on loss: net == raw
    expect(results[0].stockNetEndValuePLN).toBeCloseTo(results[0].stockRawEndValuePLN, 6);
  });

  it('applies cost basis from avgCostUSD for tax calculation', () => {
    const inputs = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      avgCostUSD: 50, // bought at $50, now $100 — unrealized gain at cost
    });
    const scenarios: Scenarios = {
      bear: { deltaStock: 0, deltaFx: 0 },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: 0, deltaFx: 0 },
    };
    const results = calcAllScenarios(inputs, scenarios);
    // Even at zero delta, there's an unrealized gain so tax is applied
    const endNbp = 1 * 100 * 4.0; // 400
    const costNbp = 1 * 50 * 4.0;  // 200
    const tax = (endNbp - costNbp) * BELKA;
    const expectedNet = endNbp - tax;
    expect(results[0].stockNetEndValuePLN).toBeCloseTo(expectedNet, 4);
  });

  it('unrealizedGainPLN computed from avgCostUSD vs current price', () => {
    const inputs = baseInputs({
      shares: 10,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      avgCostUSD: 80,
    });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    // currentValue = 10 * 100 * 4 = 4000; costBasis = 10 * 80 * 4 = 3200
    expect(results[0].unrealizedGainPLN).toBeCloseTo(800, 4);
    expect(results[0].unrealizedGainPercent).toBeCloseTo(25, 4);
  });

  it('broker fee reduces both raw end value and taxable income', () => {
    const inputs = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      brokerFeeUSD: 5, // $5 fee
    });
    const noFee = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      brokerFeeUSD: 0,
    });
    const r1 = calcAllScenarios(inputs, NEUTRAL_SCENARIOS)[0].stockNetEndValuePLN;
    const r2 = calcAllScenarios(noFee, NEUTRAL_SCENARIOS)[0].stockNetEndValuePLN;
    // Fee of $5 × 4.0 = 20 PLN reduces end value (and also reduces taxable gain)
    // difference < 20 because less taxable income means less Belka
    expect(r2 - r1).toBeGreaterThan(0);
    expect(r2 - r1).toBeLessThanOrEqual(20);
  });

  it('dividends accumulate proportionally to yield and horizon', () => {
    const inputs6 = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      dividendYieldPercent: 2.0,
      horizonMonths: 6,
    });
    const inputs12 = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
      dividendYieldPercent: 2.0,
      horizonMonths: 12,
    });
    const r6 = calcAllScenarios(inputs6, NEUTRAL_SCENARIOS)[0].dividendsNetPLN;
    const r12 = calcAllScenarios(inputs12, NEUTRAL_SCENARIOS)[0].dividendsNetPLN;
    expect(r12).toBeCloseTo(r6 * 2, 4);
  });
});

// ---------------------------------------------------------------------------
// calcAllScenarios — monotonicity and scenario structure
// ---------------------------------------------------------------------------

describe('calcAllScenarios — monotonicity and result structure', () => {
  it('bear < base < bull for stock net end value when spread scenarios used', () => {
    const inputs = baseInputs();
    const results = calcAllScenarios(inputs, SPREAD_SCENARIOS);
    expect(results[0].stockNetEndValuePLN).toBeLessThan(results[1].stockNetEndValuePLN);
    expect(results[1].stockNetEndValuePLN).toBeLessThan(results[2].stockNetEndValuePLN);
  });

  it('returns exactly 3 results keyed bear/base/bull', () => {
    const results = calcAllScenarios(baseInputs(), NEUTRAL_SCENARIOS);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.key)).toEqual(['bear', 'base', 'bull']);
  });

  it('stockBeatsBenchmark correct for bull scenario with large positive deltas', () => {
    const inputs = baseInputs();
    const scenarios: Scenarios = {
      bear: { deltaStock: -50, deltaFx: -10 },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: 80, deltaFx: 20 },
    };
    const results = calcAllScenarios(inputs, scenarios);
    expect(results[2].stockBeatsBenchmark).toBe(true);
    expect(results[0].stockBeatsBenchmark).toBe(false);
  });

  it('currentValuePLN = shares × price × fx', () => {
    const inputs = baseInputs({ shares: 5, currentPriceUSD: 200, currentFxRate: 3.8 });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].currentValuePLN).toBeCloseTo(5 * 200 * 3.8, 6);
  });

  it('inflationTotalPercent zero when inflationRate is 0', () => {
    const inputs = baseInputs({ inflationRate: 0 });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    expect(results[0].inflationTotalPercent).toBeCloseTo(0, 6);
  });

  it('inflationTotalPercent is compound, not linear', () => {
    const inputs = baseInputs({ inflationRate: 5.0, horizonMonths: 24 });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    // Compound: (1.05)^2 - 1 ≈ 10.25%, not 10%
    const expected = (Math.pow(1.05, 2) - 1) * 100;
    expect(results[0].inflationTotalPercent).toBeCloseTo(expected, 4);
  });

  it('real return uses Fisher formula (exact, not approximate)', () => {
    const inputs = baseInputs({
      inflationRate: 4.0,
      horizonMonths: 12,
      wibor3mPercent: 6.0,
    });
    const results = calcAllScenarios(inputs, NEUTRAL_SCENARIOS);
    const bmNominal = results[0].benchmarkReturnNet;
    const inflation1yr = (Math.pow(1.04, 1) - 1) * 100;
    const expectedReal = ((1 + bmNominal / 100) / (1 + inflation1yr / 100) - 1) * 100;
    expect(results[0].benchmarkRealReturnNet).toBeCloseTo(expectedReal, 4);
  });
});

// ---------------------------------------------------------------------------
// calcTimeline — geometric interpolation
// ---------------------------------------------------------------------------

describe('calcTimeline', () => {
  it('returns horizonMonths+1 points starting at month 0', () => {
    const inputs = baseInputs({ horizonMonths: 12 });
    const points = calcTimeline(inputs, NEUTRAL_SCENARIOS);
    expect(points).toHaveLength(13);
    expect(points[0].month).toBe(0);
    expect(points[12].month).toBe(12);
  });

  it('month 0 all scenarios equal current PLN value', () => {
    const inputs = baseInputs({ horizonMonths: 12 });
    const principal = 10 * 100 * 4.0; // 4000
    const points = calcTimeline(inputs, NEUTRAL_SCENARIOS);
    expect(points[0].bear).toBeCloseTo(principal, 4);
    expect(points[0].base).toBeCloseTo(principal, 4);
    expect(points[0].bull).toBeCloseTo(principal, 4);
  });

  it('final month matches calcAllScenarios stock net end value', () => {
    const inputs = baseInputs({ horizonMonths: 12 });
    const scenarios = SPREAD_SCENARIOS;
    const points = calcTimeline(inputs, scenarios);
    const allResults = calcAllScenarios(inputs, scenarios);
    const last = points[points.length - 1];
    expect(last.bear).toBeCloseTo(allResults[0].stockNetEndValuePLN, 2);
    expect(last.base).toBeCloseTo(allResults[1].stockNetEndValuePLN, 2);
    expect(last.bull).toBeCloseTo(allResults[2].stockNetEndValuePLN, 2);
  });

  it('uses geometric interpolation: midpoint != linear midpoint', () => {
    const inputs = baseInputs({ horizonMonths: 12 });
    const scenarios: Scenarios = {
      bear: { deltaStock: 0, deltaFx: 0 },
      base: { deltaStock: 100, deltaFx: 0 }, // +100% in 12 months
      bull: { deltaStock: 0, deltaFx: 0 },
    };
    const points = calcTimeline(inputs, scenarios);
    const midPoint = points[6].base;
    // Geometric: (1+1.00)^0.5 - 1 = √2 - 1 ≈ 41.4% midpoint gain
    // Linear (wrong) would be 50% midpoint gain — geometric is less
    const geomFraction = Math.pow(1 + 1.00, 0.5) - 1; // ~41.4%
    // Use actual model: shares=10, currentPriceUSD=100, currentFxRate=4, nbpMidRate=4
    // At month 6: fraction=0.5, scaledDelta = (1+1.00)^0.5 - 1 = √2 - 1
    const endNbp = 10 * 100 * (1 + geomFraction) * 4.0;
    const costNbp = 10 * 100 * 4.0;
    const expectedNet = endNbp - Math.max(endNbp - costNbp, 0) * BELKA;
    expect(midPoint).toBeCloseTo(expectedNet, 1);
    // Confirm geometric midpoint (endNbp) < linear midpoint (60% of 4000 = 2400, scaled by shares)
    const linearMidNbp = 10 * 100 * 1.5 * 4.0; // 50% gain = 6000
    expect(endNbp).toBeLessThan(linearMidNbp);
  });

  it('returns empty array when horizonMonths is 0', () => {
    const inputs = baseInputs({ horizonMonths: 0 });
    const points = calcTimeline(inputs, NEUTRAL_SCENARIOS);
    expect(points).toHaveLength(0);
  });

  it('benchmark grows over time for positive savings rate', () => {
    const inputs = baseInputs({ horizonMonths: 12, wibor3mPercent: 5.0 });
    const points = calcTimeline(inputs, NEUTRAL_SCENARIOS);
    expect(points[12].benchmark).toBeGreaterThan(points[0].benchmark);
    expect(points[6].benchmark).toBeGreaterThan(points[0].benchmark);
  });
});

// ---------------------------------------------------------------------------
// calcHeatmap — 2D multiplicative grid
// ---------------------------------------------------------------------------

describe('calcHeatmap', () => {
  it('returns (2*range/step + 1)^2 cells for default range=20, step=4', () => {
    const inputs = baseInputs();
    const cells = calcHeatmap(inputs);
    const steps = Math.floor(40 / 4) + 1; // 11
    expect(cells).toHaveLength(steps * steps); // 121
  });

  it('center cell (deltaStock=0, deltaFx=0) is close to breakeven', () => {
    // With zero deltas and flat benchmark, neither beats the other
    const inputs = baseInputs({ wibor3mPercent: 0 }); // zero benchmark return too
    const cells = calcHeatmap(inputs, 20, 4);
    const center = cells.find((c) => c.deltaStock === 0 && c.deltaFx === 0);
    expect(center).toBeDefined();
    // With 0% savings rate, benchmark == principal; stock at 0 delta == principal minus tax (if any gain)
    // Since avgCostUSD=0, cost basis = current → no tax → net == current
    expect(center!.beatsBenchmark).toBe(false); // tie goes to benchmark (not strictly >, equal is false)
  });

  it('beatsBenchmark true for large positive deltas', () => {
    const inputs = baseInputs({ wibor3mPercent: 2.0 });
    const cells = calcHeatmap(inputs, 20, 4);
    const topRight = cells.find((c) => c.deltaStock === 20 && c.deltaFx === 20);
    expect(topRight).toBeDefined();
    expect(topRight!.beatsBenchmark).toBe(true);
  });

  it('beatsBenchmark false for large negative deltas', () => {
    const inputs = baseInputs({ wibor3mPercent: 3.0 });
    const cells = calcHeatmap(inputs, 20, 4);
    const bottomLeft = cells.find((c) => c.deltaStock === -20 && c.deltaFx === -20);
    expect(bottomLeft).toBeDefined();
    expect(bottomLeft!.beatsBenchmark).toBe(false);
  });

  it('higher deltaStock cell always has higher stockNetEnd than same-dfx lower deltaStock', () => {
    const inputs = baseInputs();
    const cells = calcHeatmap(inputs, 20, 4);
    // For deltaFx = 0: deltaStock=8 should beat deltaStock=4
    const c4 = cells.find((c) => c.deltaStock === 4 && c.deltaFx === 0);
    const c8 = cells.find((c) => c.deltaStock === 8 && c.deltaFx === 0);
    expect(c4).toBeDefined();
    expect(c8).toBeDefined();
    expect(c8!.stockNetEnd).toBeGreaterThan(c4!.stockNetEnd);
  });

  it('multiplicative structure: (1+ds)×(1+dfx) not (ds+dfx)', () => {
    const inputs = baseInputs({
      shares: 1,
      currentPriceUSD: 100,
      currentFxRate: 4.0,
      nbpMidRate: 4.0,
    });
    const cells = calcHeatmap(inputs, 20, 20);
    const cell = cells.find((c) => c.deltaStock === 20 && c.deltaFx === 20);
    // Multiplicative: 100 * 1.2 * 4.0 * 1.2 = 576
    // Linear (wrong): 100 * (1 + 0.4) * 4.0 = 560
    const endNbp = 100 * 1.2 * 4.0 * 1.2; // 576
    const costNbp = 100 * 4.0; // 400
    const expectedNet = endNbp - (endNbp - costNbp) * BELKA;
    expect(cell!.stockNetEnd).toBeCloseTo(expectedNet, 4);
  });
});
