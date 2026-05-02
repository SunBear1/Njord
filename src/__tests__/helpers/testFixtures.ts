/**
 * Test Helpers & Fixtures
 *
 * Shared utilities for Njord tests:
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

export interface BaseCalcOverrides {
  shares?: number;
  currentPriceUSD?: number;
  currentFxRate?: number;
  nbpMidRate?: number;
  horizonMonths?: number;
  benchmarkType?: 'savings' | 'bonds' | 'etf';
  wibor3mPercent?: number;
  bondFirstYearRate?: number;
  bondEffectiveRate?: number;
  bondPenaltyPercent?: number;
  bondCouponFrequency?: number;
  bondReinvestmentRate?: number;
  bondMaturityMonths?: number;
  inflationRate?: number;
  avgCostUSD?: number;
  isRSU?: boolean;
  brokerFeeUSD?: number;
  dividendYieldPercent?: number;
  etfAnnualReturnPercent?: number;
  etfTerPercent?: number;
}

/**
 * Default base inputs for financial calculations.
 * Override per-test via typed partial — wrong keys cause a compile error.
 */
export function baseCalculationInputs(overrides: BaseCalcOverrides = {}) {
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

// ---------------------------------------------------------------------------
// Scenario constants
// ---------------------------------------------------------------------------

/** Neutral scenarios (zero deltas) — useful for isolating benchmark comparisons. */
export const NEUTRAL_SCENARIOS: Scenarios = {
  bear: { deltaStock: 0, deltaFx: 0 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 0, deltaFx: 0 },
};

/** Bullish scenarios with positive deltas for upside testing. */
export const BULLISH_SCENARIOS: Scenarios = {
  bear: { deltaStock: -0.2, deltaFx: -0.05 },
  base: { deltaStock: 0.1, deltaFx: 0 },
  bull: { deltaStock: 0.5, deltaFx: 0.1 },
};

/** Bearish scenarios for downside testing. */
export const BEARISH_SCENARIOS: Scenarios = {
  bear: { deltaStock: -0.5, deltaFx: -0.1 },
  base: { deltaStock: -0.2, deltaFx: -0.05 },
  bull: { deltaStock: 0, deltaFx: 0 },
};

// ---------------------------------------------------------------------------
// Common Assertions
// ---------------------------------------------------------------------------

/**
 * Assert a profit calculation respects Belka tax (19%).
 * afterTax should equal profit × (1 − 0.19) = profit × 0.81.
 */
export function assertBelkaTaxApplied(
  profit: number,
  afterTax: number,
  tolerance = 0.01,
): void {
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
 * Expected: initialValue × (1 + dStock) × (1 + dFx) = finalValue
 */
export function assertFXMultiplicative(
  dStock: number,
  dFx: number,
  initialValue: number,
  finalValue: number,
  tolerance = 0.01,
): void {
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
 * Builder for financial calculation inputs.
 * Fluent interface for readable test setup.
 *
 * @example
 * const inputs = new ScenarioBuilder()
 *   .withStocks(10)
 *   .withPrice(150)
 *   .withHorizon(24)
 *   .build();
 */
export class ScenarioBuilder {
  private overrides: BaseCalcOverrides = {};

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

  withBenchmark(type: 'savings' | 'bonds' | 'etf'): this {
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
// API Mock Helpers (Playwright / vitest-fetch-mock)
// ---------------------------------------------------------------------------

/**
 * Realistic /api/market-data success response shape.
 * Matches ProxyResponse from src/types/marketData.ts.
 */
export function mockMarketDataResponse(price = 150, fxRate = 4.0) {
  return {
    assetData: {
      asset: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        type: 'stock' as const,
        currency: 'USD',
        currentPrice: price,
      },
      historicalPrices: Array.from({ length: 252 }, (_, i) => ({
        date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
        close: price * (1 + (Math.sin(i * 0.1) * 0.05)),
      })),
    },
    fxData: {
      currentRate: fxRate,
      historicalRates: Array.from({ length: 252 }, (_, i) => ({
        date: new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
        mid: fxRate * (1 + Math.sin(i * 0.05) * 0.02),
      })),
    },
    source: 'yahoo' as const,
  };
}

/**
 * Realistic /api/market-data error response shape.
 * Matches ProxyErrorResponse from src/types/marketData.ts.
 */
export function mockMarketDataError(code = 'TICKER_NOT_FOUND', message = 'Ticker not found') {
  return { error: message, code };
}
