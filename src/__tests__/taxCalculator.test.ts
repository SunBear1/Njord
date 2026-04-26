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

  it('returns null when acquisition rate is absent (no fallback to sell rate)', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      exchangeRateAcquisitionToPLN: null,
    };
    expect(calcTransactionResult(tx)).toBeNull();
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
    expect(s.totalRevenuePLN).toBeCloseTo((10_000 + 5_000) * 4.0215, 1);
    expect(s.netIncomePLN).toBeGreaterThan(0);
    // After grosze rounding, taxDuePLN = round2(netIncomePLN × 0.19) — allow 1dp tolerance.
    expect(s.taxDuePLN).toBeCloseTo(s.netIncomePLN * 0.19, 1);
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
    expect(s.requiresPitZg).toBe(false);
    expect(s.pitZgByCurrency).toHaveLength(0);
  });
});

// ─── PIT-ZG / domestic vs foreign split ──────────────────────────────────────

describe('calcMultiTaxSummary — PIT-ZG and domestic/foreign split', () => {
  const USD_TX: TaxTransaction = {
    ...BASE_TX,
    id: 'tx-usd',
    currency: 'USD',
    saleGrossAmount: 10_000,
    acquisitionCostAmount: 7_000,
  };

  const EUR_TX: TaxTransaction = {
    ...BASE_TX,
    id: 'tx-eur',
    currency: 'EUR',
    saleGrossAmount: 5_000,
    acquisitionCostAmount: 4_000,
  };

  const PLN_TX: TaxTransaction = {
    ...BASE_TX,
    id: 'tx-pln',
    currency: 'PLN',
    saleGrossAmount: 8_000,
    acquisitionCostAmount: 6_000,
    // For PLN transactions, the "exchange rate" is always 1.0
    exchangeRateSaleToPLN: 1.0,
    exchangeRateAcquisitionToPLN: 1.0,
  };

  it('requiresPitZg = false for PLN-only transactions', () => {
    const s = calcMultiTaxSummary([PLN_TX]);
    expect(s.requiresPitZg).toBe(false);
    expect(s.pitZgByCurrency).toHaveLength(0);
    expect(s.foreignRevenuePLN).toBe(0);
    expect(s.domesticRevenuePLN).toBeCloseTo(8_000 * 1.0);
  });

  it('requiresPitZg = true when any transaction is non-PLN', () => {
    const s = calcMultiTaxSummary([USD_TX]);
    expect(s.requiresPitZg).toBe(true);
    expect(s.pitZgByCurrency).toHaveLength(1);
    expect(s.pitZgByCurrency[0].currency).toBe('USD');
  });

  it('domestic/foreign split is correct for mixed PLN + USD transactions', () => {
    const s = calcMultiTaxSummary([USD_TX, PLN_TX]);

    // USD_TX revenue = 10,000 × 4.0215 = 40,215
    // PLN_TX revenue = 8,000 × 1.0 = 8,000
    expect(s.foreignRevenuePLN).toBeCloseTo(10_000 * 4.0215, 1);
    expect(s.domesticRevenuePLN).toBeCloseTo(8_000 * 1.0, 1);
    expect(s.totalRevenuePLN).toBeCloseTo(s.foreignRevenuePLN + s.domesticRevenuePLN, 1);
  });

  it('pitZgByCurrency groups USD and EUR as separate entries', () => {
    const s = calcMultiTaxSummary([USD_TX, EUR_TX]);

    expect(s.requiresPitZg).toBe(true);
    expect(s.pitZgByCurrency).toHaveLength(2);

    const usdEntry = s.pitZgByCurrency.find((e) => e.currency === 'USD');
    const eurEntry = s.pitZgByCurrency.find((e) => e.currency === 'EUR');
    expect(usdEntry).toBeDefined();
    expect(eurEntry).toBeDefined();

    // USD entry: revenue = 10,000 × 4.0215, cost = 7,000 × 3.9102
    expect(usdEntry!.revenuePLN).toBeCloseTo(10_000 * 4.0215, 1);
    expect(usdEntry!.costPLN).toBeCloseTo(7_000 * 3.9102, 1);
    expect(usdEntry!.incomePLN).toBeCloseTo(usdEntry!.revenuePLN - usdEntry!.costPLN, 1);

    // EUR entry: revenue = 5,000 × 4.0215, cost = 4,000 × 3.9102
    expect(eurEntry!.revenuePLN).toBeCloseTo(5_000 * 4.0215, 1);
    expect(eurEntry!.costPLN).toBeCloseTo(4_000 * 3.9102, 1);
    expect(eurEntry!.incomePLN).toBeCloseTo(eurEntry!.revenuePLN - eurEntry!.costPLN, 1);
  });

  it('pitZgByCurrency incomePLN can be negative (loss in that currency)', () => {
    const lossTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-loss-usd',
      currency: 'USD',
      saleGrossAmount: 3_000,
      acquisitionCostAmount: 10_000, // big loss
    };
    const s = calcMultiTaxSummary([lossTx]);
    expect(s.requiresPitZg).toBe(true);
    expect(s.pitZgByCurrency[0].incomePLN).toBeLessThan(0);
  });

  it('two USD transactions are merged into one pitZgByCurrency entry', () => {
    const usd1 = { ...USD_TX, id: 'tx-usd-1', saleGrossAmount: 10_000, acquisitionCostAmount: 7_000 };
    const usd2 = { ...USD_TX, id: 'tx-usd-2', saleGrossAmount: 5_000, acquisitionCostAmount: 3_000 };
    const s = calcMultiTaxSummary([usd1, usd2]);

    expect(s.pitZgByCurrency).toHaveLength(1);
    expect(s.pitZgByCurrency[0].currency).toBe('USD');
    // Combined revenue = (10,000 + 5,000) × 4.0215
    expect(s.pitZgByCurrency[0].revenuePLN).toBeCloseTo(15_000 * 4.0215, 1);
  });
});

// ─── Grosze rounding ──────────────────────────────────────────────────────────

describe('grosze rounding', () => {
  it('rounds revenue, cost, gain, and tax to 2 decimal places', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      saleGrossAmount: 1234.567,
      acquisitionCostAmount: 1000.333,
      exchangeRateSaleToPLN: 4.0215,
      exchangeRateAcquisitionToPLN: 3.9102,
    };
    const r = calcTransactionResult(tx);
    expect(r).not.toBeNull();

    // All PLN values must be exact 2dp (no trailing floating-point dust)
    expect(r!.revenuePLN).toBe(Math.round(1234.567 * 4.0215 * 100) / 100);
    expect(r!.costPLN).toBe(Math.round(1000.333 * 3.9102 * 100) / 100);
    expect(Number(r!.gainPLN.toFixed(2))).toBe(r!.gainPLN);
    expect(Number(r!.taxEstimatePLN.toFixed(2))).toBe(r!.taxEstimatePLN);
  });

  it('rounds summary totals to 2dp', () => {
    const tx1: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-r1',
      saleGrossAmount: 100.111,
      acquisitionCostAmount: 50.222,
    };
    const tx2: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-r2',
      saleGrossAmount: 200.333,
      acquisitionCostAmount: 100.444,
    };
    const s = calcMultiTaxSummary([tx1, tx2]);

    expect(Number(s.totalRevenuePLN.toFixed(2))).toBe(s.totalRevenuePLN);
    expect(Number(s.totalCostPLN.toFixed(2))).toBe(s.totalCostPLN);
    expect(Number(s.netIncomePLN.toFixed(2))).toBe(s.netIncomePLN);
    expect(Number(s.taxDuePLN.toFixed(2))).toBe(s.taxDuePLN);
  });
});

// ─── ESPP cost basis ──────────────────────────────────────────────────────────

describe('ESPP cost basis via calcTransactionResult', () => {
  it('uses purchase price (not FMV) for ESPP tax calculation', () => {
    // Simulates the ESPP row from etrade_espp_sample.xlsx:
    // Proceeds: 5288.42, Acquisition Cost (Purchase Price): 3091.46
    // Sale NBP rate (2023-06-05): 4.1933, Acq NBP rate (2023-06-02): 4.1903
    const esppTx: TaxTransaction = {
      id: 'espp-1',
      tradeType: 'sale',
      acquisitionMode: 'purchase',
      zeroCostFlag: false,
      saleDate: '2023-06-06',
      acquisitionDate: '2023-06-05',
      currency: 'USD',
      saleGrossAmount: 5288.42,
      acquisitionCostAmount: 3091.46, // Purchase Price × qty (NOT Adjusted Cost Basis)
      exchangeRateSaleToPLN: 4.1933,
      exchangeRateAcquisitionToPLN: 4.1903,
    };

    const r = calcTransactionResult(esppTx);
    expect(r).not.toBeNull();
    expect(r!.revenuePLN).toBeCloseTo(22175.93, 1);
    expect(r!.costPLN).toBeCloseTo(12954.15, 1);
    expect(r!.gainPLN).toBeCloseTo(9221.78, 1);
    expect(r!.taxEstimatePLN).toBeCloseTo(1752.14, 1);
    expect(r!.isLoss).toBe(false);
  });
});

// ─── Dual-currency transactions ───────────────────────────────────────────────

describe('dual-currency (acquisitionCurrency !== currency)', () => {
  it('supports PLN acquisition + USD sale (buy in PLN, sell in USD)', () => {
    // Bought shares on Polish market for PLN, sold on US market for USD.
    // Acquisition: 15,000 PLN → rate = 1.0 (no conversion needed)
    // Sale: 5,000 USD × 4.0 NBP rate = 20,000 PLN
    const tx: TaxTransaction = {
      ...BASE_TX,
      currency: 'USD',
      acquisitionCurrency: 'PLN',
      saleGrossAmount: 5_000,
      acquisitionCostAmount: 15_000,
      exchangeRateSaleToPLN: 4.0,
      exchangeRateAcquisitionToPLN: 1.0, // PLN → 1:1
    };

    const r = calcTransactionResult(tx);
    expect(r).not.toBeNull();
    // Revenue: 5,000 × 4.0 = 20,000
    expect(r!.revenuePLN).toBeCloseTo(20_000);
    // Cost: 15,000 × 1.0 = 15,000
    expect(r!.costPLN).toBeCloseTo(15_000);
    // Gain: 20,000 - 15,000 = 5,000
    expect(r!.gainPLN).toBeCloseTo(5_000);
    // Tax: 5,000 × 0.19 = 950
    expect(r!.taxEstimatePLN).toBeCloseTo(950);
    expect(r!.isLoss).toBe(false);
  });

  it('supports EUR acquisition + USD sale', () => {
    // Bought in EUR, sold in USD — each leg has its own NBP rate
    const tx: TaxTransaction = {
      ...BASE_TX,
      currency: 'USD',
      acquisitionCurrency: 'EUR',
      saleGrossAmount: 10_000,
      acquisitionCostAmount: 8_000,
      exchangeRateSaleToPLN: 4.02,   // USD rate
      exchangeRateAcquisitionToPLN: 4.35, // EUR rate
    };

    const r = calcTransactionResult(tx);
    expect(r).not.toBeNull();
    // Revenue: 10,000 × 4.02 = 40,200
    expect(r!.revenuePLN).toBeCloseTo(40_200);
    // Cost: 8,000 × 4.35 = 34,800
    expect(r!.costPLN).toBeCloseTo(34_800);
    // Gain: 40,200 - 34,800 = 5,400
    expect(r!.gainPLN).toBeCloseTo(5_400);
    // Tax: 5,400 × 0.19 = 1,026
    expect(r!.taxEstimatePLN).toBeCloseTo(1_026);
  });

  it('dual-currency loss when EUR acquisition cost exceeds USD revenue in PLN', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      currency: 'USD',
      acquisitionCurrency: 'EUR',
      saleGrossAmount: 5_000,
      acquisitionCostAmount: 8_000,
      exchangeRateSaleToPLN: 4.02,   // USD rate
      exchangeRateAcquisitionToPLN: 4.35, // EUR rate → cost = 34,800
    };

    const r = calcTransactionResult(tx);
    expect(r).not.toBeNull();
    // Revenue: 5,000 × 4.02 = 20,100
    // Cost: 8,000 × 4.35 = 34,800
    // Gain: 20,100 - 34,800 = -14,700
    expect(r!.gainPLN).toBeCloseTo(-14_700);
    expect(r!.taxEstimatePLN).toBe(0);
    expect(r!.isLoss).toBe(true);
  });

  it('dual-currency with commissions in respective currencies', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      currency: 'USD',
      acquisitionCurrency: 'PLN',
      saleGrossAmount: 10_000,
      acquisitionCostAmount: 30_000,
      saleBrokerFee: 10,        // 10 USD commission on sale
      acquisitionBrokerFee: 50, // 50 PLN commission on purchase
      exchangeRateSaleToPLN: 4.0,
      exchangeRateAcquisitionToPLN: 1.0, // PLN
    };

    const r = calcTransactionResult(tx);
    expect(r).not.toBeNull();
    // Revenue: 10,000 × 4.0 = 40,000
    expect(r!.revenuePLN).toBeCloseTo(40_000);
    // Cost: (30,000 + 50) × 1.0 + 10 × 4.0 = 30,050 + 40 = 30,090
    expect(r!.costPLN).toBeCloseTo(30_090);
    // Gain: 40,000 - 30,090 = 9,910
    expect(r!.gainPLN).toBeCloseTo(9_910);
    // Tax: 9,910 × 0.19 = 1,882.90
    expect(r!.taxEstimatePLN).toBeCloseTo(1_882.9);
  });

  it('multi-summary with mixed currencies aggregates correctly', () => {
    const usdTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-usd',
      currency: 'USD',
      saleGrossAmount: 10_000,
      acquisitionCostAmount: 7_000,
      exchangeRateSaleToPLN: 4.0,
      exchangeRateAcquisitionToPLN: 3.9,
    };
    const dualTx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-dual',
      currency: 'USD',
      acquisitionCurrency: 'PLN',
      saleGrossAmount: 5_000,
      acquisitionCostAmount: 15_000,
      exchangeRateSaleToPLN: 4.0,
      exchangeRateAcquisitionToPLN: 1.0,
    };

    const s = calcMultiTaxSummary([usdTx, dualTx]);
    // USD tx revenue: 10,000 × 4.0 = 40,000
    // Dual tx revenue: 5,000 × 4.0 = 20,000
    expect(s.totalRevenuePLN).toBeCloseTo(60_000);
    // USD tx cost: 7,000 × 3.9 = 27,300
    // Dual tx cost: 15,000 × 1.0 = 15,000
    expect(s.totalCostPLN).toBeCloseTo(42_300);
    expect(s.netIncomePLN).toBeCloseTo(17_700);
    expect(s.taxDuePLN).toBeCloseTo(17_700 * 0.19, 1);
  });
});

// ─── Solidarity levy & PIT-38 field mapping ──────────────────────────────────

describe('solidarity levy', () => {
  it('is zero when net income below 1M PLN', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-small',
      saleGrossAmount: 100_000,
      acquisitionCostAmount: 50_000,
    };
    const s = calcMultiTaxSummary([tx]);
    expect(s.solidarityLevyPLN).toBe(0);
  });

  it('charges 4% on income exceeding 1M PLN', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-big',
      currency: 'PLN',
      saleGrossAmount: 2_000_000,
      acquisitionCostAmount: 500_000,
      exchangeRateSaleToPLN: 1,
      exchangeRateAcquisitionToPLN: 1,
    };
    const s = calcMultiTaxSummary([tx]);
    expect(s.netIncomePLN).toBe(1_500_000);
    expect(s.solidarityLevyPLN).toBe(20_000);
  });

  it('is zero when net income is exactly 1M PLN', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-exact',
      currency: 'PLN',
      saleGrossAmount: 1_500_000,
      acquisitionCostAmount: 500_000,
      exchangeRateSaleToPLN: 1,
      exchangeRateAcquisitionToPLN: 1,
    };
    const s = calcMultiTaxSummary([tx]);
    expect(s.netIncomePLN).toBe(1_000_000);
    expect(s.solidarityLevyPLN).toBe(0);
  });
});

describe('PIT-38 field mapping', () => {
  it('maps profitable transaction to correct Poz. fields', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-pit38',
      currency: 'PLN',
      saleGrossAmount: 100_000,
      acquisitionCostAmount: 60_000,
      exchangeRateSaleToPLN: 1,
      exchangeRateAcquisitionToPLN: 1,
    };
    const s = calcMultiTaxSummary([tx]);
    expect(s.pit38Fields.poz24_revenue).toBe(100_000);
    expect(s.pit38Fields.poz25_costs).toBe(60_000);
    expect(s.pit38Fields.poz26_income).toBe(40_000);
    expect(s.pit38Fields.poz27_loss).toBe(0);
    expect(s.pit38Fields.poz33_taxBase).toBe(40_000);
    expect(s.pit38Fields.poz34_tax).toBe(7_600);
  });

  it('maps loss to Poz. 27, income fields are zero', () => {
    const tx: TaxTransaction = {
      ...BASE_TX,
      id: 'tx-loss-pit38',
      currency: 'PLN',
      saleGrossAmount: 40_000,
      acquisitionCostAmount: 60_000,
      exchangeRateSaleToPLN: 1,
      exchangeRateAcquisitionToPLN: 1,
    };
    const s = calcMultiTaxSummary([tx]);
    expect(s.pit38Fields.poz24_revenue).toBe(40_000);
    expect(s.pit38Fields.poz25_costs).toBe(60_000);
    expect(s.pit38Fields.poz26_income).toBe(0);
    expect(s.pit38Fields.poz27_loss).toBe(20_000);
    expect(s.pit38Fields.poz33_taxBase).toBe(0);
    expect(s.pit38Fields.poz34_tax).toBe(0);
  });

  it('empty list yields all-zero fields', () => {
    const s = calcMultiTaxSummary([]);
    expect(s.pit38Fields.poz24_revenue).toBe(0);
    expect(s.pit38Fields.poz34_tax).toBe(0);
    expect(s.solidarityLevyPLN).toBe(0);
  });
});

// ─── Dividend tax ─────────────────────────────────────────────────────────────

describe('calcTransactionResult — dividends', () => {
  const makeDividendTx = (overrides: Partial<TaxTransaction> = {}): TaxTransaction => ({
    id: 'div-1',
    tradeType: 'dividend',
    acquisitionMode: 'purchase',
    zeroCostFlag: false,
    saleDate: '2024-06-15',
    currency: 'USD',
    saleGrossAmount: 0,
    exchangeRateSaleToPLN: 4.0,
    dividendGrossAmount: 1000,
    withholdingTaxRate: 0.15,
    sourceCountry: 'US',
    ...overrides,
  });

  it('US dividend — 15% WHT credited against 19% Belka → 4% top-up', () => {
    const result = calcTransactionResult(makeDividendTx());
    expect(result).not.toBeNull();
    // Gross: 1000 × 4.0 = 4,000 PLN
    expect(result!.revenuePLN).toBe(4_000);
    // WHT: 1000 × 0.15 × 4.0 = 600 PLN
    expect(result!.whtPaidPLN).toBe(600);
    // Polish full tax: 4000 × 0.19 = 760
    // Credit: min(600, 760) = 600
    expect(result!.whtCreditPLN).toBe(600);
    // Top-up: 760 - 600 = 160
    expect(result!.polishTopUpPLN).toBe(160);
    expect(result!.taxEstimatePLN).toBe(160);
    expect(result!.isDividend).toBe(true);
  });

  it('UK dividend — 0% WHT → full 19% Polish tax', () => {
    const result = calcTransactionResult(makeDividendTx({
      withholdingTaxRate: 0,
      sourceCountry: 'GB',
    }));
    expect(result!.whtPaidPLN).toBe(0);
    expect(result!.whtCreditPLN).toBe(0);
    // Full 19%: 4000 × 0.19 = 760
    expect(result!.polishTopUpPLN).toBe(760);
  });

  it('German dividend — 26.375% WHT → credit capped at 19%', () => {
    const result = calcTransactionResult(makeDividendTx({
      withholdingTaxRate: 0.26375,
      sourceCountry: 'DE',
    }));
    // WHT: 1000 × 0.26375 × 4.0 = 1055 PLN
    expect(result!.whtPaidPLN).toBe(1055);
    // Credit capped: min(1055, 760) = 760
    expect(result!.whtCreditPLN).toBe(760);
    // No top-up needed — WHT exceeds Polish rate
    expect(result!.polishTopUpPLN).toBe(0);
  });

  it('returns null for missing NBP rate', () => {
    const result = calcTransactionResult(makeDividendTx({
      exchangeRateSaleToPLN: null,
    }));
    expect(result).toBeNull();
  });

  it('returns null for zero dividend amount', () => {
    const result = calcTransactionResult(makeDividendTx({
      dividendGrossAmount: 0,
    }));
    expect(result).toBeNull();
  });
});

describe('calcMultiTaxSummary — dividends', () => {
  it('aggregates dividend totals', () => {
    const txs: TaxTransaction[] = [
      {
        id: 'div-1',
        tradeType: 'dividend',
        acquisitionMode: 'purchase',
        zeroCostFlag: false,
        saleDate: '2024-03-15',
        currency: 'USD',
        saleGrossAmount: 0,
        exchangeRateSaleToPLN: 4.0,
        dividendGrossAmount: 500,
        withholdingTaxRate: 0.15,
        sourceCountry: 'US',
      },
      {
        id: 'div-2',
        tradeType: 'dividend',
        acquisitionMode: 'purchase',
        zeroCostFlag: false,
        saleDate: '2024-06-15',
        currency: 'USD',
        saleGrossAmount: 0,
        exchangeRateSaleToPLN: 4.2,
        dividendGrossAmount: 300,
        withholdingTaxRate: 0.15,
        sourceCountry: 'US',
      },
    ];

    const summary = calcMultiTaxSummary(txs);

    // Div 1: gross = 500×4.0 = 2000, WHT = 75×4.0 = 300
    // Div 2: gross = 300×4.2 = 1260, WHT = 45×4.2 = 189
    expect(summary.totalDividendGrossPLN).toBe(3_260);
    expect(summary.totalWhtPaidPLN).toBe(489);
    expect(summary.totalDividendTopUpPLN).toBeGreaterThan(0);
  });
});
