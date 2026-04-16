import { describe, it, expect } from 'vitest';
import { calcBelkaTax } from '../utils/taxCalculator';
import type { TaxInputs } from '../types/tax';

const BASE_INPUTS: TaxInputs = {
  totalProceedsUSD: 19_500,   // e.g. 100 shares × $195
  totalCostBasisUSD: 15_000,  // e.g. 100 shares × $150
  brokerFeeUSD: 0,
  nbpRateSell: 4.0,
  nbpRateBuy: 3.85,
  kantorRate: 3.95,
};

describe('calcBelkaTax', () => {
  it('computes 19% Belka on positive gain (NBP-based)', () => {
    const result = calcBelkaTax(BASE_INPUTS);

    // Revenue: 19,500 × 4.0 = 78,000
    expect(result.revenueNbpPLN).toBeCloseTo(78_000);
    // Cost: 15,000 × 3.85 = 57,750
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

    // Gross: 19,500 × 3.95 = 77,025
    expect(result.grossProceedsKantorPLN).toBeCloseTo(77_025);
    // Net: 77,025 - 0 (fee) - 3,847.50 (tax) = 73,177.50
    expect(result.netProceedsPLN).toBeCloseTo(73_177.5);
    // Effective rate: 3,847.50 / 77,025 × 100 ≈ 4.99%
    expect(result.effectiveTaxRate).toBeCloseTo(4.994, 2);
  });

  it('returns zero tax on loss (proceeds < cost basis in PLN)', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      totalProceedsUSD: 12_000, // 12,000 × 4.0 = 48,000 < cost 57,750
    });

    // Revenue: 12,000 × 4.0 = 48,000
    // Cost: 57,750
    // Gain: 48,000 - 57,750 = -9,750
    expect(result.taxableGainPLN).toBeCloseTo(-9_750);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.isLoss).toBe(true);
    expect(result.effectiveTaxRate).toBe(0);
  });

  it('returns zero tax on exact break-even', () => {
    // proceeds × nbpRateSell === costBasis × nbpRateBuy → same rates, same USD totals
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      totalProceedsUSD: 15_000,
      totalCostBasisUSD: 15_000,
      nbpRateSell: 3.85,
      nbpRateBuy: 3.85,
    });

    expect(result.taxableGainPLN).toBeCloseTo(0);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.isLoss).toBe(true); // <= 0 is loss
  });

  it('handles RSU/grant (totalCostBasisUSD = 0) — full proceeds taxable', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      totalCostBasisUSD: 0,
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

  it('handles different NBP rates for buy vs sell dates (FX gain only)', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      totalProceedsUSD: 15_000,  // same USD total
      totalCostBasisUSD: 15_000,
      nbpRateSell: 4.2,  // PLN weakened → USD worth more at sell
      nbpRateBuy: 3.5,   // PLN was stronger at buy
    });

    // Revenue: 15,000 × 4.2 = 63,000
    // Cost: 15,000 × 3.5 = 52,500
    // Gain from FX movement alone: 10,500
    expect(result.taxableGainPLN).toBeCloseTo(10_500);
    expect(result.belkaTaxPLN).toBeCloseTo(1_995); // 10,500 × 0.19
    expect(result.isLoss).toBe(false);
  });

  it('handles very small gain without floating-point issues', () => {
    const result = calcBelkaTax({
      totalProceedsUSD: 100.01,
      totalCostBasisUSD: 100.00,
      brokerFeeUSD: 0,
      nbpRateSell: 4.0,
      nbpRateBuy: 4.0,
      kantorRate: 3.95,
    });

    // Gain: 100.01 × 4 - 100 × 4 = 400.04 - 400 = 0.04
    expect(result.taxableGainPLN).toBeCloseTo(0.04);
    expect(result.belkaTaxPLN).toBeCloseTo(0.0076); // 0.04 × 0.19
    expect(result.isLoss).toBe(false);
  });

  it('returns zero tax for zero proceeds', () => {
    const result = calcBelkaTax({
      ...BASE_INPUTS,
      totalProceedsUSD: 0,
    });

    expect(result.revenueNbpPLN).toBe(0);
    expect(result.belkaTaxPLN).toBe(0);
    expect(result.grossProceedsKantorPLN).toBe(0);
    expect(result.isLoss).toBe(true);
    expect(result.effectiveTaxRate).toBe(0);
  });
});
