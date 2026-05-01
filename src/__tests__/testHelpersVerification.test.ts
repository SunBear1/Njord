/**
 * Test Helpers Verification
 *
 * Verifies that shared test helpers are working correctly
 * and can be imported and used in other tests.
 */

import { describe, it, expect } from 'vitest';
import {
  baseCalculationInputs,
  NEUTRAL_SCENARIOS,
  BULLISH_SCENARIOS,
  BELKA_RATE,
  ScenarioBuilder,
  assertBelkaTaxApplied,
  generateMockNBPRate,
  generateMockStockPrice,
} from './helpers';

describe('Test Helpers Verification', () => {
  describe('baseCalculationInputs', () => {
    it('returns default base inputs with no overrides', () => {
      const inputs = baseCalculationInputs();

      expect(inputs.shares).toBe(10);
      expect(inputs.currentPriceUSD).toBe(100);
      expect(inputs.horizonMonths).toBe(12);
      expect(inputs.isRSU).toBe(false);
    });

    it('applies overrides correctly', () => {
      const inputs = baseCalculationInputs({
        shares: 20,
        currentPriceUSD: 200,
        isRSU: true,
      });

      expect(inputs.shares).toBe(20);
      expect(inputs.currentPriceUSD).toBe(200);
      expect(inputs.horizonMonths).toBe(12); // unchanged
      expect(inputs.isRSU).toBe(true);
    });
  });

  describe('Scenario constants', () => {
    it('NEUTRAL_SCENARIOS has all zero deltas', () => {
      expect(NEUTRAL_SCENARIOS.bear.deltaStock).toBe(0);
      expect(NEUTRAL_SCENARIOS.base.deltaStock).toBe(0);
      expect(NEUTRAL_SCENARIOS.bull.deltaStock).toBe(0);
      expect(NEUTRAL_SCENARIOS.bear.deltaFx).toBe(0);
    });

    it('BULLISH_SCENARIOS has positive deltas for bull case', () => {
      expect(BULLISH_SCENARIOS.bull.deltaStock).toBeGreaterThan(0);
      expect(BULLISH_SCENARIOS.bull.deltaFx).toBeGreaterThan(0);
    });
  });

  describe('ScenarioBuilder', () => {
    it('builds with default values', () => {
      const inputs = new ScenarioBuilder().build();

      expect(inputs.shares).toBe(10);
      expect(inputs.currentPriceUSD).toBe(100);
    });

    it('chains multiple setters', () => {
      const inputs = new ScenarioBuilder()
        .withStocks(20)
        .withPrice(150)
        .withHorizon(24)
        .withFxRate(4.5)
        .build();

      expect(inputs.shares).toBe(20);
      expect(inputs.currentPriceUSD).toBe(150);
      expect(inputs.horizonMonths).toBe(24);
      expect(inputs.currentFxRate).toBe(4.5);
    });

    it('withCostBasis sets avgCostUSD', () => {
      const inputs = new ScenarioBuilder()
        .withCostBasis(80)
        .build();

      expect(inputs.avgCostUSD).toBe(80);
    });

    it('asRSU sets isRSU=true and avgCostUSD=0', () => {
      const inputs = new ScenarioBuilder()
        .asRSU()
        .build();

      expect(inputs.isRSU).toBe(true);
      expect(inputs.avgCostUSD).toBe(0);
    });
  });

  describe('Assertions', () => {
    it('assertBelkaTaxApplied validates Belka tax correctly', () => {
      const profit = 10_000;
      const afterTax = profit * (1 - BELKA_RATE);

      // Should not throw
      expect(() => {
        assertBelkaTaxApplied(profit, afterTax);
      }).not.toThrow();
    });

    it('assertBelkaTaxApplied throws on incorrect tax', () => {
      const profit = 10_000;
      const incorrectTax = 5_000; // Wrong amount

      expect(() => {
        assertBelkaTaxApplied(profit, incorrectTax);
      }).toThrow(/Belka tax mismatch/);
    });
  });

  describe('Mock Generators', () => {
    it('generateMockNBPRate creates valid rate object', () => {
      const rate = generateMockNBPRate(4.25);

      expect(rate.mid).toBe(4.25);
      expect(rate.bid).toBeLessThan(rate.mid);
      expect(rate.ask).toBeGreaterThan(rate.mid);
    });

    it('generateMockStockPrice creates valid price object', () => {
      const price = generateMockStockPrice(155);

      expect(price.symbol).toBe('AAPL');
      expect(price.price).toBe(155);
      expect(price.timestamp).toBeTruthy();
    });
  });

  describe('BELKA_RATE constant', () => {
    it('is 0.19 (19%)', () => {
      expect(BELKA_RATE).toBe(0.19);
    });
  });
});
