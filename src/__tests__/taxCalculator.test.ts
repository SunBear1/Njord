import { describe, it, expect } from 'vitest';
import { calcBelkaTax } from '../utils/taxCalculator';
import type { TaxInputs } from '../types/tax';

const BASE_INPUTS: TaxInputs = {
  shares: 100,
  sellPriceUSD: 195,
  costBasisUSD: 150,
  brokerFeeUSD: 0,
  nbpRateSell: 4.0,
  nbpRateBuy: 3.85,
  kantorRate: 3.95,
};

describe('calcBelkaTax', () => {
  it('computes 19% Belka on positive gain (NBP-based)', () => {
    const result = calcBelkaTax(BASE_INPUTS);

    // Revenue: 100 × 195 × 4.0 = 78,000
    expect(result.revenueNbpPLN).toBeCloseTo(78_000);
    // Cost: 100 × 150 × 3.85 = 57,750
    expect(result.costBasisNbpPLN).toBeCloseTo(57_750);
    // Taxable gain: 78,000 - 57,750 = 20,250
    expect(result.taxableGainPLN).toBeCloseTo(20_250);
    // Tax: 20,250 × 0.19 = 3,847.50
    expect(result.belkaTaxPLN).toBeCloseTo(3_847.5);
    expect(result.isLoss).toBe(false);
    expect(result.isRSU).toBe(false);
  });

  it('computes kantor-based payout correctly', () => {
    const result = calcBelkaTax(BASE_INPUTS);

    // Gross: 100 × 195 × 3.95 = 77,025
    expect(result.grossProceedsKantorPLN).toBeCloseTo(77_025);
    // Net: 77,025 - 0 (fee) - 3,847.50 (tax) = 73,177.50
    expect(result.netProceedsPLN).toBeCloseTo(73_177.5);
    // Effective rate: 3,847.50 / 77,025 × 100 ≈ 4.99%
    expect(result.effectiveTaxRate).toBeCloseTo(4.994, 2);
  });

  it('returns zero tax on loss (sell < buy)', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      sellPriceUSD: 120, // below cost basis of 150
    });

    // Revenue: 100 × 120 × 4.0 = 48,000
    // Cost: 57,750
    // Gain: 48,000 - 57,750 = -9,750
    expect(result.taxableGainPLN).toBeCloseTo(-9_750);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.isLoss).toBe(true);
    expect(result.effectiveTaxRate).toBe(0);
  });

  it('returns zero tax on exact break-even', () => {
    // sellPrice × nbpRateSell === costBasis × nbpRateBuy
    // 150 × 3.85 = 57,750 → sellPrice = 57,750 / (100 × 4.0) per share = 144.375/share total... 
    // Simpler: same rates
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      sellPriceUSD: 150,
      nbpRateSell: 3.85,
      nbpRateBuy: 3.85,
    });

    expect(result.taxableGainPLN).toBeCloseTo(0);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.isLoss).toBe(true); // <= 0 is loss
  });

  it('handles RSU/grant (costBasis = 0) — full proceeds taxable', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      costBasisUSD: 0,
    });

    expect(result.isRSU).toBe(true);
    // Cost basis: 0
    expect(result.costBasisNbpPLN).toBe(0);
    // Taxable gain = full revenue: 78,000
    expect(result.taxableGainPLN).toBeCloseTo(78_000);
    // Tax: 78,000 × 0.19 = 14,820
    expect(result.belkaTaxPLN).toBeCloseTo(14_820);
  });

  it('deducts broker fee from taxable gain', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      brokerFeeUSD: 10,
    });

    // Fee NBP: 10 × 4.0 = 40
    expect(result.brokerFeeNbpPLN).toBeCloseTo(40);
    // Taxable: 78,000 - 57,750 - 40 = 20,210
    expect(result.taxableGainPLN).toBeCloseTo(20_210);
    // Tax: 20,210 × 0.19 = 3,839.90
    expect(result.belkaTaxPLN).toBeCloseTo(3_839.9);

    // Kantor fee: 10 × 3.95 = 39.50
    expect(result.brokerFeeKantorPLN).toBeCloseTo(39.5);
    // Net: 77,025 - 39.50 - 3,839.90 = 73,145.60
    expect(result.netProceedsPLN).toBeCloseTo(73_145.6);
  });

  it('handles different NBP rates for buy vs sell dates', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      sellPriceUSD: 150, // same USD price
      costBasisUSD: 150,
      nbpRateSell: 4.2,  // PLN weakened → USD worth more at sell
      nbpRateBuy: 3.5,   // PLN was stronger at buy
    });

    // Revenue: 100 × 150 × 4.2 = 63,000
    // Cost: 100 × 150 × 3.5 = 52,500
    // Gain from FX movement alone: 10,500
    expect(result.taxableGainPLN).toBeCloseTo(10_500);
    expect(result.belkaTaxPLN).toBeCloseTo(1_995); // 10,500 × 0.19
    expect(result.isLoss).toBe(false);
  });

  it('handles very small gain without floating-point issues', () => {
    const result = calcBelkaTax({
      shares: 1,
      sellPriceUSD: 100.01,
      costBasisUSD: 100.00,
      brokerFeeUSD: 0,
      nbpRateSell: 4.0,
      nbpRateBuy: 4.0,
      kantorRate: 3.95,
    });

    // Gain: 1 × 100.01 × 4 - 1 × 100 × 4 = 400.04 - 400 = 0.04
    expect(result.taxableGainPLN).toBeCloseTo(0.04);
    expect(result.belkaTaxPLN).toBeCloseTo(0.0076); // 0.04 × 0.19
    expect(result.isLoss).toBe(false);
  });

  it('returns zero values for zero shares', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      shares: 0,
    });

    expect(result.revenueNbpPLN).toBe(0);
    expect(result.costBasisNbpPLN).toBe(0);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.grossProceedsKantorPLN).toBe(0);
    expect(result.netProceedsPLN).toBe(0);
    expect(result.effectiveTaxRate).toBe(0);
  });
});
