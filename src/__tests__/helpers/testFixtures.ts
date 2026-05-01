/**
 * Test Helpers & Fixtures
 *
 * Shared utilities for tests:
 * - Financial calculation fixtures (base inputs, scenarios)
 * - Mock data generators
 * - Common assertions
 */

import type { Scenarios } from '../../types/scenario';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BELKA_RATE = 0.19;
export const DEFAULT_WIBOR_3M = 5.0;
export const DEFAULT_INFLATION = 0;

// ---------------------------------------------------------------------------
// Financial Calculation Fixtures
// ---------------------------------------------------------------------------

/**
 * Default base inputs for financial calculations.
 * Override per-test as needed.
 */
export function baseCalculationInputs(
  overrides: Record<string, unknown> = {},
) {
  return {
    shares: 10,
    currentPriceUSD: 100,
    currentFxRate: 4.0,
    nbpMidRate: 4.0,
    horizonMonths: 12,
    benchmarkType: 'savings' as const,
    wibor3mPercent: DEFAULT_WIBOR_3M,
    bondFirstYearRate: 6.0,
    bondEffectiveRate: 6.0,
    bondPenaltyPercent: 0,
    bondCouponFrequency: 0,
    bondReinvestmentRate: 5.0,
    bondMaturityMonths: 36,
    inflationRate: DEFAULT_INFLATION,
    avgCostUSD: 0,
    isRSU: false,
    brokerFeeUSD: 0,
    dividendYieldPercent: 0,
    etfAnnualReturnPercent: 8,
    etfTerPercent: 0.07,
    ...overrides,
  };
}

/**
 * Neutral scenarios (no delta) for baseline testing.
 */
export const NEUTRAL_SCENARIOS: Scenarios = {
  bear: { deltaStock: 0, deltaFx: 0 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 0, deltaFx: 0 },
};

/**
 * Bullish scenarios (positive deltas) for upside testing.
 */
export const BULLISH_SCENARIOS: Scenarios = {
  bear: { deltaStock: -0.2, deltaFx: -0.05 },
  base: { deltaStock: 0.1, deltaFx: 0 },
  bull: { deltaStock: 0.5, deltaFx: 0.1 },
};

/**
 * Bearish scenarios (negative deltas) for downside testing.
 */
export const BEARISH_SCENARIOS: Scenarios = {
  bear: { deltaStock: -0.5, deltaFx: -0.1 },
  base: { deltaStock: -0.2, deltaFx: -0.05 },
  bull: { deltaStock: 0, deltaFx: 0 },
};

// ---------------------------------------------------------------------------
// Bond Presets
// ---------------------------------------------------------------------------

/**
 * Bond preset data for testing (mirrors src/data/bondPresets.ts)
 */
export const TEST_BOND_PRESETS = {
  'OTS (Obligacja Trzyletnich Skarbowych)': {
    label: 'OTS',
    rate: 5.1,
    maturityMonths: 36,
  },
  'EDO (Obligacja Emerytów Dochód Osobisty)': {
    label: 'EDO',
    rate: 5.85,
    maturityMonths: 168,
  },
  'ROS (Obligacja Oszczędnościowa)': {
    label: 'ROS',
    rate: 5.0,
    maturityMonths: 168,
  },
};

// ---------------------------------------------------------------------------
// Common Mock Generators
// ---------------------------------------------------------------------------

/**
 * Generate mock NBP rate data for testing.
 */
export function generateMockNBPRate(midRate: number = 4.0) {
  return {
    mid: midRate,
    bid: midRate - 0.02,
    ask: midRate + 0.02,
  };
}

/**
 * Generate mock stock price data for testing.
 */
export function generateMockStockPrice(price: number = 150) {
  return {
    symbol: 'AAPL',
    price,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate mock tax transaction for testing.
 */
export function generateMockTaxTransaction(
  date: string = '2024-01-01',
  amount: number = 1000,
  type: 'buy' | 'sell' = 'buy',
) {
  return {
    date,
    ticker: 'AAPL',
    quantity: 10,
    priceUSD: amount / 10,
    type,
    fees: 0,
  };
}

// ---------------------------------------------------------------------------
// Common Assertions
// ---------------------------------------------------------------------------

/**
 * Assert PLN value is formatted correctly (to 2 decimal places).
 */
export function assertPLNValue(value: unknown): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(`Expected number, got ${typeof value}`);
  }
  // Check if number has at most 2 decimal places
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 0.001) {
    throw new Error(`PLN value ${value} should have at most 2 decimal places`);
  }
}

/**
 * Assert a profit calculation respects Belka tax (19%).
 *
 * Given profit and Belka tax applied, verify: afterTax = profit * (1 - BELKA)
 */
export function assertBelkaTaxApplied(
  profit: number,
  afterTax: number,
  tolerance: number = 0.01,
) {
  const expected = profit * (1 - BELKA_RATE);
  const diff = Math.abs(afterTax - expected);
  if (diff > tolerance) {
    throw new Error(
      `Belka tax mismatch: expected ~${expected.toFixed(2)}, got ${afterTax.toFixed(2)}`,
    );
  }
}

/**
 * Assert that FX and stock deltas are multiplicative, not additive.
 *
 * (1 + dStock) * (1 + dFx) = final multiplier
 */
export function assertFXMultiplicative(
  dStock: number,
  dFx: number,
  initialValue: number,
  finalValue: number,
  tolerance: number = 0.01,
) {
  const expectedMultiplier = (1 + dStock) * (1 + dFx);
  const expected = initialValue * expectedMultiplier;
  const diff = Math.abs(finalValue - expected);
  if (diff > tolerance) {
    throw new Error(
      `FX multiplicativity mismatch: expected ~${expected.toFixed(2)}, got ${finalValue.toFixed(2)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Test Data Builders (Fluent API)
// ---------------------------------------------------------------------------

/**
 * Builder for financial calculation scenarios.
 * Fluent interface for test setup.
 *
 * @example
 * const inputs = new ScenarioBuilder()
 *   .withStocks(10)
 *   .withPrice(150)
 *   .withHorizon(24)
 *   .build();
 */
export class ScenarioBuilder {
  private overrides: Record<string, unknown> = {};

  withStocks(count: number): this {
    this.overrides.shares = count;
    return this;
  }

  withPrice(priceUSD: number): this {
    this.overrides.currentPriceUSD = priceUSD;
    return this;
  }

  withFxRate(rate: number): this {
    this.overrides.currentFxRate = rate;
    this.overrides.nbpMidRate = rate;
    return this;
  }

  withHorizon(months: number): this {
    this.overrides.horizonMonths = months;
    return this;
  }

  withBenchmark(type: string): this {
    this.overrides.benchmarkType = type;
    return this;
  }

  withCostBasis(costUSD: number): this {
    this.overrides.avgCostUSD = costUSD;
    return this;
  }

  withDividends(yieldPercent: number): this {
    this.overrides.dividendYieldPercent = yieldPercent;
    return this;
  }

  withBrokerFees(feeUSD: number): this {
    this.overrides.brokerFeeUSD = feeUSD;
    return this;
  }

  withInflation(rate: number): this {
    this.overrides.inflationRate = rate;
    return this;
  }

  asRSU(): this {
    this.overrides.isRSU = true;
    this.overrides.avgCostUSD = 0;
    return this;
  }

  build() {
    return baseCalculationInputs(this.overrides);
  }
}

// ---------------------------------------------------------------------------
// API Mock Helpers
// ---------------------------------------------------------------------------

/**
 * Mock fetch response for NBP API.
 */
export function mockNBPFetchResponse(rate: number = 4.0) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rates: [
        {
          mid: rate,
        },
      ],
    }),
  };
}

/**
 * Mock fetch response for Yahoo Finance API.
 */
export function mockYahooFinanceFetchResponse(price: number = 150) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      chart: {
        result: [
          {
            meta: { currency: 'USD' },
            timestamp: [Math.floor(Date.now() / 1000)],
            indicators: {
              quote: [
                {
                  close: [price],
                },
              ],
            },
          },
        ],
      },
    }),
  };
}

/**
 * Mock fetch response for error scenarios.
 */
export function mockFetchError(status: number = 500, message: string = 'Server Error') {
  return {
    ok: false,
    status,
    json: async () => ({
      error: {
        message,
      },
    }),
  };
}
