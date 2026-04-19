import { describe, it, expect } from 'vitest';
import { calcBelkaTax, calcTransactionResult, calcMultiTaxSummary } from '../utils/taxCalculator';
import type { TaxInputs, TaxTransaction } from '../types/tax';

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

// ─── calcTransactionResult ────────────────────────────────────────────────────

const BASE_TX: TaxTransaction = {
  id: 'tx-1',
  tradeType: 'sale',
  acquisitionMode: 'purchase',
  zeroCostFlag: false,
  saleDate: '2024-06-10',
  acquisitionDate: '2024-01-15',
  currency: 'USD',
  saleGrossAmount: 19_500,
  acquisitionCostAmount: 15_000,
  saleBrokerFee: 0,
  acquisitionBrokerFee: 0,
  exchangeRateSaleToPLN: 4.0215,
  exchangeRateAcquisitionToPLN: 3.9102,
};

describe('calcTransactionResult', () => {
  it('computes revenue, cost, gain, and tax correctly', () => {
    const r = calcTransactionResult(BASE_TX);
    expect(r).not.toBeNull();

    // Revenue: 19,500 × 4.0215 = 78,419.25
    expect(r!.revenuePLN).toBeCloseTo(78_419.25);
    // Cost: 15,000 × 3.9102 = 58,653
    expect(r!.costPLN).toBeCloseTo(58_653);
    // Gain: 78,419.25 - 58,653 = 19,766.25
    expect(r!.gainPLN).toBeCloseTo(19_766.25);
    // Tax: 19,766.25 × 0.19 = 3,755.59
    expect(r!.taxEstimatePLN).toBeCloseTo(3_755.59, 1);
    expect(r!.isLoss).toBe(false);
    expect(r!.isZeroCost).toBe(false);
  });

  it('returns null when sell rate is missing', () => {
    const tx: TaxTransaction = { ...BASE_TX, exchangeRateSaleToPLN: null };
    expect(calcTransactionResult(tx)).toBeNull();
  });

  it('zero tax and isLoss=true for a loss transaction', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      saleGrossAmount: 12_000, // 12,000 × 4.0215 = 48,258 < cost 58,653
    };
    const r = calcTransactionResult(tx);
    expect(r!.gainPLN).toBeLessThan(0);
    expect(r!.taxEstimatePLN).toBe(0);
    expect(r!.isLoss).toBe(true);
  });

  it('zeroCostFlag=true: acquisition cost = 0, full revenue taxable', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      zeroCostFlag: true,
      acquisitionMode: 'grant',
      acquisitionCostAmount: 0,
    };
    const r = calcTransactionResult(tx);
    // Cost: 0 (sale fee is 0, no acquisition)
    expect(r!.costPLN).toBeCloseTo(0);
    // Revenue = gain
    expect(r!.gainPLN).toBeCloseTo(r!.revenuePLN);
    expect(r!.isZeroCost).toBe(true);
    // Tax: full revenue × 0.19
    expect(r!.taxEstimatePLN).toBeCloseTo(r!.revenuePLN * 0.19, 2);
  });

  it('deducts both buy and sell commissions from taxable gain', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      saleBrokerFee: 4.95,
      acquisitionBrokerFee: 4.95,
    };
    const r = calcTransactionResult(tx);
    // Buy fee: 4.95 × 3.9102 = 19.36
    // Sell fee: 4.95 × 4.0215 = 19.91
    // costPLN = 58,653 + 19.36 + 19.91 = 58,692.27
    expect(r!.costPLN).toBeCloseTo(58_692.27, 1);
    // Gain = 78,419.25 - 58,692.27 = 19,726.98
    expect(r!.gainPLN).toBeCloseTo(19_726.98, 1);
  });

  it('falls back to sell rate when acquisition rate is absent', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      exchangeRateAcquisitionToPLN: null,
    };
    const r = calcTransactionResult(tx);
    // costPLN = 15,000 × 4.0215 (sell rate fallback)
    expect(r!.costPLN).toBeCloseTo(15_000 * 4.0215);
  });
});

// ─── calcMultiTaxSummary ──────────────────────────────────────────────────────

describe('calcMultiTaxSummary', () => {
  it('sums two profitable transactions', () => {
    const tx1 = { ...BASE_TX, id: 'tx-1', saleGrossAmount: 10_000, acquisitionCostAmount: 7_000 };
    const tx2 = { ...BASE_TX, id: 'tx-2', saleGrossAmount: 5_000, acquisitionCostAmount: 3_000 };
    const s = calcMultiTaxSummary([tx1, tx2]);

    // tx1 gain: (10,000 - 7,000) × rate = 3,000 × 4.0215 - 7,000 × 3.9102
    // tx2 gain: (5,000 - 3,000) × rate
    expect(s.totalRevenuePLN).toBeCloseTo((10_000 + 5_000) * 4.0215);
    expect(s.netIncomePLN).toBeGreaterThan(0);
    expect(s.taxDuePLN).toBeCloseTo(s.netIncomePLN * 0.19, 2);
    expect(s.totalLossPLN).toBe(0);
  });

  it('loss offsets gain — tax on net income (less than sum of per-tx taxes)', () => {
    const gainTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-gain',
      saleGrossAmount: 10_000,
      acquisitionCostAmount: 7_000,
    };
    const lossTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-loss',
      saleGrossAmount: 3_000,
      acquisitionCostAmount: 5_000, // loss: 3,000 × rate < 5,000 × rate
    };
    const s = calcMultiTaxSummary([gainTx, lossTx]);

    expect(s.totalGainPLN).toBeGreaterThan(0);
    expect(s.totalLossPLN).toBeGreaterThan(0);
    // Net income less than gain-only scenario → tax reduced
    expect(s.netIncomePLN).toBeLessThan(s.totalGainPLN);
    expect(s.taxDuePLN).toBeCloseTo(Math.max(0, s.netIncomePLN) * 0.19, 2);
  });

  it('all-loss scenario → taxDue = 0', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-loss',
      saleGrossAmount: 5_000,
      acquisitionCostAmount: 10_000,
    };
    const s = calcMultiTaxSummary([tx]);

    expect(s.netIncomePLN).toBeLessThan(0);
    expect(s.taxDuePLN).toBe(0);
  });

  it('skips transactions with missing exchange rates', () => {
    const readyTx: TaxTransaction = { ...BASE_TX, id: 'tx-ready' };
    const notReadyTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-not-ready',
      exchangeRateSaleToPLN: null,
    };
    const s = calcMultiTaxSummary([readyTx, notReadyTx]);
    // Only readyTx is included
    expect(s.totalRevenuePLN).toBeCloseTo(BASE_TX.saleGrossAmount * BASE_TX.exchangeRateSaleToPLN!);
  });

  it('empty transaction list → all zeros', () => {
    const s = calcMultiTaxSummary([]);
    expect(s.totalRevenuePLN).toBe(0);
    expect(s.taxDuePLN).toBe(0);
    expect(s.netIncomePLN).toBe(0);
  });
});
