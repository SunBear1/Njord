import { describe, test, expect } from 'vitest';
import {
  allocateMonthly,
  calcIkzePitDeduction,
  calcAccumulationResult,
} from '../utils/accumulationCalculator';
import type {
  AccumulationInputs,
  BucketConfig,
} from '../types/accumulation';
import {
  IKE_LIMIT_2026,
  IKZE_LIMIT_2026,
  BELKA_RATE,
  IKZE_RYCZALT_RATE,
} from '../types/accumulation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStocksBucket(wrapper: 'ike' | 'ikze' | 'regular', enabled = true): BucketConfig {
  return {
    wrapper,
    instrument: 'stocks',
    enabled,
    stockReturnPercent: 8,
    dividendYieldPercent: 1.5,
    fxSpreadPercent: 0.35,
    bondPresetId: '',
    bondFirstYearRate: 0,
    bondEffectiveRate: 0,
    bondRateType: 'fixed',
    bondMargin: 0,
    bondCouponFrequency: 0,
  };
}

function makeBondsBucket(wrapper: 'ike' | 'ikze' | 'regular', enabled = true): BucketConfig {
  return {
    wrapper,
    instrument: 'bonds',
    enabled,
    stockReturnPercent: 0,
    dividendYieldPercent: 0,
    fxSpreadPercent: 0,
    bondPresetId: 'EDO',
    bondFirstYearRate: 6.2,
    bondEffectiveRate: 5.0,
    bondRateType: 'inflation',
    bondMargin: 2.0,
    bondCouponFrequency: 0,
  };
}

function makeInputs(overrides?: Partial<AccumulationInputs>): AccumulationInputs {
  return {
    totalMonthlyPLN: 3000,
    horizonYears: 20,
    pitBracket: 12,
    inflationRate: 3.0,
    ikeAnnualLimit: IKE_LIMIT_2026,
    ikzeAnnualLimit: IKZE_LIMIT_2026,
    savingsRate: 5.0,
    buckets: [
      makeStocksBucket('ike'),
      makeStocksBucket('ikze'),
      makeStocksBucket('regular'),
    ],
    ...overrides,
  };
}

// ─── Allocation Tests ─────────────────────────────────────────────────────────

describe('allocateMonthly', () => {
  test('IKE fills first, then IKZE, then overflow to regular', () => {
    const buckets = [makeStocksBucket('ike'), makeStocksBucket('ikze'), makeStocksBucket('regular')];
    const alloc = allocateMonthly(3000, IKE_LIMIT_2026, IKZE_LIMIT_2026, buckets);

    expect(alloc[0]).toBeCloseTo(IKE_LIMIT_2026 / 12, 0); // IKE: ~2017/mo
    expect(alloc[1]).toBeCloseTo(IKZE_LIMIT_2026 / 12, 0); // IKZE: ~840/mo
    expect(alloc[2]).toBeCloseTo(3000 - IKE_LIMIT_2026 / 12 - IKZE_LIMIT_2026 / 12, 0); // Regular: overflow
    expect(alloc[0] + alloc[1] + alloc[2]).toBeCloseTo(3000, 2);
  });

  test('disabled IKE sends everything to IKZE + regular', () => {
    const buckets = [
      makeStocksBucket('ike', false),
      makeStocksBucket('ikze'),
      makeStocksBucket('regular'),
    ];
    const alloc = allocateMonthly(3000, IKE_LIMIT_2026, IKZE_LIMIT_2026, buckets);

    expect(alloc[0]).toBe(0); // IKE disabled
    expect(alloc[1]).toBeCloseTo(IKZE_LIMIT_2026 / 12, 0);
    expect(alloc[2]).toBeCloseTo(3000 - IKZE_LIMIT_2026 / 12, 0);
    expect(alloc[0] + alloc[1] + alloc[2]).toBeCloseTo(3000, 2);
  });

  test('small budget fits entirely in IKE', () => {
    const buckets = [makeStocksBucket('ike'), makeStocksBucket('ikze'), makeStocksBucket('regular')];
    const alloc = allocateMonthly(1000, IKE_LIMIT_2026, IKZE_LIMIT_2026, buckets);

    expect(alloc[0]).toBe(1000); // All in IKE
    expect(alloc[1]).toBe(0);
    expect(alloc[2]).toBe(0);
  });

  test('all disabled returns zero allocation', () => {
    const buckets = [
      makeStocksBucket('ike', false),
      makeStocksBucket('ikze', false),
      makeStocksBucket('regular', false),
    ];
    const alloc = allocateMonthly(3000, IKE_LIMIT_2026, IKZE_LIMIT_2026, buckets);

    expect(alloc.every(a => a === 0)).toBe(true);
  });
});

// ─── IKE Tax Advantage ────────────────────────────────────────────────────────

describe('IKE tax advantage', () => {
  test('IKE terminal value ≥ regular for same return (stocks)', () => {
    // All stocks, same return — IKE should beat regular due to no dividend tax + no exit tax
    const ikeOnly = makeInputs({
      totalMonthlyPLN: 2000,
      horizonYears: 20,
      buckets: [
        makeStocksBucket('ike'),
        makeStocksBucket('ikze', false),
        makeStocksBucket('regular', false),
      ],
    });
    const regularOnly = makeInputs({
      totalMonthlyPLN: 2000,
      horizonYears: 20,
      buckets: [
        makeStocksBucket('ike', false),
        makeStocksBucket('ikze', false),
        makeStocksBucket('regular'),
      ],
    });

    const ikeResult = calcAccumulationResult(ikeOnly);
    const regularResult = calcAccumulationResult(regularOnly);

    expect(ikeResult.totalTerminalNet).toBeGreaterThan(regularResult.totalTerminalNet);
  });

  test('IKE terminal value ≥ regular for same return (bonds)', () => {
    const ikeOnly = makeInputs({
      totalMonthlyPLN: 2000,
      horizonYears: 10,
      buckets: [
        makeBondsBucket('ike'),
        makeBondsBucket('ikze', false),
        makeBondsBucket('regular', false),
      ],
    });
    const regularOnly = makeInputs({
      totalMonthlyPLN: 2000,
      horizonYears: 10,
      buckets: [
        makeBondsBucket('ike', false),
        makeBondsBucket('ikze', false),
        makeBondsBucket('regular'),
      ],
    });

    const ikeResult = calcAccumulationResult(ikeOnly);
    const regularResult = calcAccumulationResult(regularOnly);

    expect(ikeResult.totalTerminalNet).toBeGreaterThan(regularResult.totalTerminalNet);
  });
});

// ─── IKZE PIT Deduction ───────────────────────────────────────────────────────

describe('IKZE PIT deduction', () => {
  test('PIT deduction reinvestment adds meaningful value', () => {
    const deductionValue = calcIkzePitDeduction(
      IKZE_LIMIT_2026, // yearly contribution
      0.12,            // 12% bracket
      5.0,             // savings rate
      20,              // 20 years
    );

    // 20 years × ~10k/yr × 12% = ~24k nominal deductions, compounded should be more
    expect(deductionValue).toBeGreaterThan(IKZE_LIMIT_2026 * 0.12 * 20);
    expect(deductionValue).toBeLessThan(IKZE_LIMIT_2026 * 0.12 * 20 * 3); // sanity upper bound
  });

  test('32% bracket yields more than 12% bracket', () => {
    const low = calcIkzePitDeduction(IKZE_LIMIT_2026, 0.12, 5.0, 20);
    const high = calcIkzePitDeduction(IKZE_LIMIT_2026, 0.32, 5.0, 20);

    expect(high).toBeGreaterThan(low);
    expect(high / low).toBeCloseTo(0.32 / 0.12, 0); // approximately proportional
  });

  test('zero savings rate means no compounding', () => {
    const value = calcIkzePitDeduction(10000, 0.12, 0, 10);

    // With 0% savings rate, each year's deduction stays flat
    expect(value).toBeCloseTo(10000 * 0.12 * 10, 0);
  });
});

// ─── Zero Return ──────────────────────────────────────────────────────────────

describe('zero return', () => {
  test('zero return stocks → terminal ≈ contributions (minus FX spread)', () => {
    const inputs = makeInputs({
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      buckets: [
        { ...makeStocksBucket('ike'), stockReturnPercent: 0, dividendYieldPercent: 0 },
        makeStocksBucket('ikze', false),
        makeStocksBucket('regular', false),
      ],
    });

    const result = calcAccumulationResult(inputs);
    const totalContributed = 1000 * 12 * 5;
    const fxDrag = 1 / (1 + 0.35 / 100);

    // Terminal should be contributions minus FX spread loss
    expect(result.totalTerminalNet).toBeCloseTo(totalContributed * fxDrag, -1);
  });

  test('zero return bonds → terminal = contributions exactly', () => {
    const inputs = makeInputs({
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      buckets: [
        { ...makeBondsBucket('ike'), bondFirstYearRate: 0, bondEffectiveRate: 0 },
        makeBondsBucket('ikze', false),
        makeBondsBucket('regular', false),
      ],
    });

    const result = calcAccumulationResult(inputs);
    const totalContributed = 1000 * 12 * 5;

    // IKE + 0% bond rate → no tax, no gains, exact contribution return
    expect(result.totalTerminalNet).toBeCloseTo(totalContributed, 0);
  });
});

// ─── Bond vs Stocks Distinction ───────────────────────────────────────────────

describe('instrument behavior', () => {
  test('bonds bucket has no FX conversion (PLN-denominated)', () => {
    const bondInputs = makeInputs({
      totalMonthlyPLN: 1000,
      horizonYears: 1,
      buckets: [
        { ...makeBondsBucket('ike'), bondFirstYearRate: 0, bondEffectiveRate: 0 },
        makeBondsBucket('ikze', false),
        makeBondsBucket('regular', false),
      ],
    });

    const result = calcAccumulationResult(bondInputs);

    // With 0% return and IKE wrapper, should get exactly what was put in
    expect(result.totalTerminalNet).toBeCloseTo(1000 * 12, 0);
  });

  test('stocks bucket loses value to FX spread', () => {
    const stockInputs = makeInputs({
      totalMonthlyPLN: 1000,
      horizonYears: 1,
      buckets: [
        { ...makeStocksBucket('ike'), stockReturnPercent: 0, dividendYieldPercent: 0, fxSpreadPercent: 1.0 },
        makeStocksBucket('ikze', false),
        makeStocksBucket('regular', false),
      ],
    });

    const result = calcAccumulationResult(stockInputs);
    const totalContributed = 1000 * 12;

    // Should be less than contributed due to 1% FX spread
    expect(result.totalTerminalNet).toBeLessThan(totalContributed);
    expect(result.totalTerminalNet).toBeGreaterThan(totalContributed * 0.98);
  });
});

// ─── Inflation Erosion ────────────────────────────────────────────────────────

describe('inflation erosion', () => {
  test('inflation erodes purchasing power over time', () => {
    const inputs = makeInputs({ inflationRate: 5.0, horizonYears: 10 });
    const result = calcAccumulationResult(inputs);

    const lastSnap = result.combinedSnapshots[result.combinedSnapshots.length - 1];

    // After 10 years at 5% inflation, purchasing power of contributions should be much lower
    expect(lastSnap.inflationErodedContributions).toBeLessThan(lastSnap.totalContributed);
    // Roughly: 1/(1.05^10) ≈ 0.614
    const expectedRatio = 1 / Math.pow(1.05, 10);
    const totalMonthlyContributions = inputs.totalMonthlyPLN * 10 * 12;
    expect(lastSnap.inflationErodedContributions).toBeCloseTo(totalMonthlyContributions * expectedRatio, -2);
  });

  test('zero inflation means no erosion', () => {
    const inputs = makeInputs({ inflationRate: 0, horizonYears: 5 });
    const result = calcAccumulationResult(inputs);

    const lastSnap = result.combinedSnapshots[result.combinedSnapshots.length - 1];
    const totalMonthlyContributions = inputs.totalMonthlyPLN * 5 * 12;

    expect(lastSnap.inflationErodedContributions).toBeCloseTo(totalMonthlyContributions, 0);
  });
});

// ─── Milestones ───────────────────────────────────────────────────────────────

describe('milestone detection', () => {
  test('detects 100k milestone', () => {
    const inputs = makeInputs({
      totalMonthlyPLN: 5000,
      horizonYears: 10,
    });

    const result = calcAccumulationResult(inputs);

    const m100k = result.milestones.find(m => m.threshold === 100_000);
    expect(m100k).toBeDefined();
    // 5000/mo × 12 = 60k/year, so 100k should be crossed within first 2 years
    expect(m100k!.year).toBeLessThanOrEqual(3);
  });

  test('no milestones for very small investments', () => {
    const inputs = makeInputs({
      totalMonthlyPLN: 100,
      horizonYears: 5,
    });

    const result = calcAccumulationResult(inputs);

    // 100/mo × 60 months = 6k total contributed — far from 100k
    expect(result.milestones.length).toBe(0);
  });
});

// ─── Counterfactual ───────────────────────────────────────────────────────────

describe('counterfactual (all-regular)', () => {
  test('IKE+IKZE always beats all-regular for positive returns', () => {
    const inputs = makeInputs({
      totalMonthlyPLN: 3000,
      horizonYears: 20,
    });

    const result = calcAccumulationResult(inputs);

    // Tax savings should be positive (IKE+IKZE beat regular)
    expect(result.taxSavings).toBeGreaterThan(0);
    expect(result.taxSavingsPercent).toBeGreaterThan(0);
    expect(result.totalTerminalNet).toBeGreaterThan(result.counterfactualNet);
  });

  test('tax savings grow with horizon', () => {
    const short = calcAccumulationResult(makeInputs({ horizonYears: 5 }));
    const long = calcAccumulationResult(makeInputs({ horizonYears: 30 }));

    // Compound tax advantage grows over time
    expect(long.taxSavingsPercent).toBeGreaterThan(short.taxSavingsPercent);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  test('zero monthly amount produces zero result', () => {
    const inputs = makeInputs({ totalMonthlyPLN: 0 });
    const result = calcAccumulationResult(inputs);

    expect(result.totalTerminalNet).toBe(0);
    expect(result.totalContributed).toBe(0);
    expect(result.milestones.length).toBe(0);
  });

  test('minimum horizon (5 years) produces valid result', () => {
    const inputs = makeInputs({ horizonYears: 5 });
    const result = calcAccumulationResult(inputs);

    expect(result.totalTerminalNet).toBeGreaterThan(0);
    expect(result.combinedSnapshots.length).toBe(6); // years 0-5
  });

  test('max horizon (40 years) produces valid result', () => {
    const inputs = makeInputs({ horizonYears: 40 });
    const result = calcAccumulationResult(inputs);

    expect(result.totalTerminalNet).toBeGreaterThan(0);
    expect(result.combinedSnapshots.length).toBe(41); // years 0-40
    expect(Number.isFinite(result.totalTerminalNet)).toBe(true);
  });

  test('all bonds allocation works', () => {
    const inputs = makeInputs({
      buckets: [
        makeBondsBucket('ike'),
        makeBondsBucket('ikze'),
        makeBondsBucket('regular'),
      ],
    });

    const result = calcAccumulationResult(inputs);

    expect(result.totalTerminalNet).toBeGreaterThan(0);
    expect(result.buckets.every(b => b.instrument === 'bonds')).toBe(true);
  });

  test('mixed allocation (stocks + bonds) works', () => {
    const inputs = makeInputs({
      buckets: [
        makeStocksBucket('ike'),
        makeBondsBucket('ikze'),
        makeStocksBucket('regular'),
      ],
    });

    const result = calcAccumulationResult(inputs);

    expect(result.totalTerminalNet).toBeGreaterThan(0);
    expect(result.buckets[0].instrument).toBe('stocks');
    expect(result.buckets[1].instrument).toBe('bonds');
  });
});

// ─── Tax Rate Constants ───────────────────────────────────────────────────────

describe('tax constants', () => {
  test('Belka rate is 19%', () => {
    expect(BELKA_RATE).toBe(0.19);
  });

  test('IKZE ryczałt rate is 10%', () => {
    expect(IKZE_RYCZALT_RATE).toBe(0.10);
  });

  test('IKE limit 2026', () => {
    expect(IKE_LIMIT_2026).toBe(24_204);
  });

  test('IKZE limit 2026', () => {
    expect(IKZE_LIMIT_2026).toBe(10_081);
  });
});

// ─── calcWeightedReturn ───────────────────────────────────────────────────────

import { calcWeightedReturn, calcPortfolioResult } from '../utils/accumulationCalculator';
import type { PortfolioAllocation, WrapperPortfolioConfig } from '../types/portfolio';

describe('calcWeightedReturn', () => {
  test('single instrument 100% returns its rate', () => {
    const allocs: PortfolioAllocation[] = [
      { instrumentId: 'msci', instrumentType: 'etf', allocationPercent: 100, expectedReturnPercent: 9 },
    ];
    expect(calcWeightedReturn(allocs)).toBeCloseTo(9, 5);
  });

  test('50/50 split returns average', () => {
    const allocs: PortfolioAllocation[] = [
      { instrumentId: 'etf1', instrumentType: 'etf', allocationPercent: 50, expectedReturnPercent: 10 },
      { instrumentId: 'bond1', instrumentType: 'bonds', allocationPercent: 50, expectedReturnPercent: 6 },
    ];
    expect(calcWeightedReturn(allocs)).toBeCloseTo(8, 5);
  });

  test('three-way weighted return', () => {
    const allocs: PortfolioAllocation[] = [
      { instrumentId: 'a', instrumentType: 'etf', allocationPercent: 60, expectedReturnPercent: 10 },
      { instrumentId: 'b', instrumentType: 'bonds', allocationPercent: 30, expectedReturnPercent: 6 },
      { instrumentId: 'c', instrumentType: 'savings', allocationPercent: 10, expectedReturnPercent: 4 },
    ];
    expect(calcWeightedReturn(allocs)).toBeCloseTo(8.2, 5);
  });

  test('empty array returns 0', () => {
    expect(calcWeightedReturn([])).toBe(0);
  });

  test('all zero allocations returns 0', () => {
    const allocs: PortfolioAllocation[] = [
      { instrumentId: 'a', instrumentType: 'etf', allocationPercent: 0, expectedReturnPercent: 10 },
    ];
    expect(calcWeightedReturn(allocs)).toBe(0);
  });
});

// ─── calcPortfolioResult ──────────────────────────────────────────────────────

import type { BondPreset } from '../types/scenario';

const MOCK_BOND_PRESETS: BondPreset[] = [
  {
    id: 'EDO',
    name: 'Obligacje 10-letnie indeksowane inflacją',
    maturityMonths: 120,
    rateType: 'inflation',
    firstYearRate: 6.2,
    margin: 2.0,
    earlyRedemptionPenalty: 2.0,
    earlyRedemptionAllowed: true,
    couponFrequency: 0,
    description: 'EDO',
  },
  {
    id: 'COI',
    name: 'Obligacje 4-letnie indeksowane inflacją',
    maturityMonths: 48,
    rateType: 'inflation',
    firstYearRate: 6.0,
    margin: 1.5,
    earlyRedemptionPenalty: 0.7,
    earlyRedemptionAllowed: true,
    couponFrequency: 1,
    description: 'COI',
  },
  {
    id: 'TOS',
    name: 'Obligacje 3-letnie stałoprocentowe',
    maturityMonths: 36,
    rateType: 'fixed',
    firstYearRate: 5.7,
    margin: 0,
    earlyRedemptionPenalty: 0.7,
    earlyRedemptionAllowed: false,
    couponFrequency: 0,
    description: 'TOS',
  },
  {
    id: 'ROR',
    name: 'Obligacje roczne',
    maturityMonths: 12,
    rateType: 'reference',
    firstYearRate: 5.5,
    margin: 0,
    earlyRedemptionPenalty: 0.5,
    earlyRedemptionAllowed: true,
    couponFrequency: 12,
    description: 'ROR',
  },
];

describe('calcPortfolioResult', () => {
  function makeWrapperConfig(
    wrapper: 'ike' | 'ikze' | 'regular',
    enabled: boolean,
    allocs: PortfolioAllocation[],
    brokerId: string | null = 'xtb',
  ): WrapperPortfolioConfig {
    return { wrapper, enabled, brokerId, allocations: allocs };
  }

  const etfAlloc: PortfolioAllocation[] = [
    { instrumentId: 'msci', instrumentType: 'etf', allocationPercent: 100, expectedReturnPercent: 8 },
  ];

  const bondAlloc: PortfolioAllocation[] = [
    { instrumentId: 'EDO', instrumentType: 'bonds', allocationPercent: 100, expectedReturnPercent: 6.2 },
  ];

  const mixedAlloc: PortfolioAllocation[] = [
    { instrumentId: 'msci', instrumentType: 'etf', allocationPercent: 60, expectedReturnPercent: 8 },
    { instrumentId: 'EDO', instrumentType: 'bonds', allocationPercent: 40, expectedReturnPercent: 6.2 },
  ];

  const defaultInputs = {
    totalMonthlyPLN: 2000,
    horizonYears: 10,
    pitBracket: 12,
    inflationRate: 3.5,
    ikeAnnualLimit: 26019,
    ikzeAnnualLimit: 10407.6,
    savingsRate: 4,
    reinvestIkzeDeduction: false,
    bondPresets: MOCK_BOND_PRESETS,
  };

  test('positive result for 10-year all-ETF portfolio', () => {
    const result = calcPortfolioResult({
      ...defaultInputs,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', true, etfAlloc),
        makeWrapperConfig('regular', true, etfAlloc, null),
      ],
    });
    expect(result.totalTerminalNet).toBeGreaterThan(result.totalContributed);
    expect(result.annualTable).toHaveLength(10);
  });

  test('annual table row count matches horizon', () => {
    const result = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      pitBracket: 32,
      inflationRate: 2.5,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });
    expect(result.annualTable).toHaveLength(5);
  });

  test('disabled wrappers produce zero values', () => {
    const result = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });
    const ikzeBucket = result.buckets.find(b => b.wrapper === 'ikze');
    expect(ikzeBucket?.terminalGrossValue).toBe(0);
  });

  test('IKE has tax advantage over regular', () => {
    const result = calcPortfolioResult({
      ...defaultInputs,
      horizonYears: 20,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', true, etfAlloc),
        makeWrapperConfig('regular', true, etfAlloc, null),
      ],
    });
    expect(result.taxSavings).toBeGreaterThan(0);
  });

  // ── Per-allocation simulation tests ────────────────────────────────────────

  test('mixed ETF+bond wrapper simulates each instrument independently', () => {
    const mixedResult = calcPortfolioResult({
      ...defaultInputs,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, mixedAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const etfOnlyResult = calcPortfolioResult({
      ...defaultInputs,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const bondOnlyResult = calcPortfolioResult({
      ...defaultInputs,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, bondAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    // Mixed result should be between pure ETF and pure bond results
    const ikeMixed = mixedResult.buckets.find(b => b.wrapper === 'ike')!;
    const ikeEtf = etfOnlyResult.buckets.find(b => b.wrapper === 'ike')!;
    const ikeBond = bondOnlyResult.buckets.find(b => b.wrapper === 'ike')!;

    const minVal = Math.min(ikeEtf.terminalGrossValue, ikeBond.terminalGrossValue);
    const maxVal = Math.max(ikeEtf.terminalGrossValue, ikeBond.terminalGrossValue);
    expect(ikeMixed.terminalGrossValue).toBeGreaterThan(minVal);
    expect(ikeMixed.terminalGrossValue).toBeLessThan(maxVal);
  });

  test('bond allocation uses actual preset parameters', () => {
    const edoAlloc: PortfolioAllocation[] = [
      { instrumentId: 'EDO', instrumentType: 'bonds', allocationPercent: 100, expectedReturnPercent: 6.2 },
    ];
    const tosAlloc: PortfolioAllocation[] = [
      { instrumentId: 'TOS', instrumentType: 'bonds', allocationPercent: 100, expectedReturnPercent: 5.7 },
    ];

    const edoResult = calcPortfolioResult({
      ...defaultInputs,
      horizonYears: 10,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, edoAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const tosResult = calcPortfolioResult({
      ...defaultInputs,
      horizonYears: 10,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, tosAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const ikeEdo = edoResult.buckets.find(b => b.wrapper === 'ike')!;
    const ikeTos = tosResult.buckets.find(b => b.wrapper === 'ike')!;

    expect(ikeEdo.terminalGrossValue).toBeGreaterThan(ikeEdo.totalContributed);
    expect(ikeTos.terminalGrossValue).toBeGreaterThan(ikeTos.totalContributed);
    // EDO (6.2% yr1, 5.5% yr2+) vs TOS (5.7% all years) — different results
    expect(ikeEdo.terminalGrossValue).not.toBeCloseTo(ikeTos.terminalGrossValue, 0);
  });

  test('savings allocation applies Belka only in regular wrapper', () => {
    const savingsAlloc: PortfolioAllocation[] = [
      { instrumentId: 'savings', instrumentType: 'savings', allocationPercent: 100, expectedReturnPercent: 5 },
    ];

    const ikeResult = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, savingsAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const regularResult = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 1000,
      horizonYears: 5,
      wrapperConfigs: [
        makeWrapperConfig('ike', false, [], null),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', true, savingsAlloc, null),
      ],
    });

    const ikeBucket = ikeResult.buckets.find(b => b.wrapper === 'ike')!;
    const regBucket = regularResult.buckets.find(b => b.wrapper === 'regular')!;

    // IKE savings (no Belka) should grow more than regular savings (with Belka)
    expect(ikeBucket.terminalGrossValue).toBeGreaterThan(regBucket.terminalGrossValue);
  });

  test('100% single instrument matches expected growth direction', () => {
    const result = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 1000,
      horizonYears: 20,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, etfAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const ike = result.buckets.find(b => b.wrapper === 'ike')!;
    expect(ike.totalContributed).toBeCloseTo(240_000, -2);
    expect(ike.terminalGrossValue).toBeGreaterThan(300_000);
  });

  test('three-instrument allocation in regular wrapper', () => {
    const threeWay: PortfolioAllocation[] = [
      { instrumentId: 'msci', instrumentType: 'etf', allocationPercent: 50, expectedReturnPercent: 8 },
      { instrumentId: 'EDO', instrumentType: 'bonds', allocationPercent: 30, expectedReturnPercent: 6.2 },
      { instrumentId: 'savings', instrumentType: 'savings', allocationPercent: 20, expectedReturnPercent: 5 },
    ];

    const result = calcPortfolioResult({
      ...defaultInputs,
      totalMonthlyPLN: 3000,
      horizonYears: 10,
      wrapperConfigs: [
        makeWrapperConfig('ike', false, [], null),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', true, threeWay, null),
      ],
    });

    const reg = result.buckets.find(b => b.wrapper === 'regular')!;
    expect(reg.terminalGrossValue).toBeGreaterThan(reg.totalContributed);
    expect(reg.exitTaxPaid).toBeGreaterThan(0);
    expect(reg.terminalNetValue).toBeLessThan(reg.terminalGrossValue);
  });

  test('inflation rate affects inflation-linked bond effective rate', () => {
    const highInflation = calcPortfolioResult({
      ...defaultInputs,
      inflationRate: 10,
      horizonYears: 10,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, bondAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const lowInflation = calcPortfolioResult({
      ...defaultInputs,
      inflationRate: 1,
      horizonYears: 10,
      wrapperConfigs: [
        makeWrapperConfig('ike', true, bondAlloc),
        makeWrapperConfig('ikze', false, [], null),
        makeWrapperConfig('regular', false, [], null),
      ],
    });

    const highIke = highInflation.buckets.find(b => b.wrapper === 'ike')!;
    const lowIke = lowInflation.buckets.find(b => b.wrapper === 'ike')!;

    expect(highIke.terminalGrossValue).toBeGreaterThan(lowIke.terminalGrossValue);
  });
});
