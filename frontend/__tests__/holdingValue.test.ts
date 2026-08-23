import { describe, it, expect } from 'vitest';
import { calcBondHoldingCurrentValue, calcSavingsHoldingCurrentValue, calcTermDepositHoldingCurrentValue } from '../utils/holdingValue';
import type { BondHolding, SavingsHolding, TermDepositHolding } from '../types/holding';
import type { BondPreset } from '../types/scenario';

const OTS_PRESET: BondPreset = {
  id: 'OTS',
  name: 'OTS (3-mies.)',
  maturityMonths: 3,
  rateType: 'fixed',
  firstYearRate: 6,
  margin: 0,
  earlyRedemptionPenalty: 0.5,
  earlyRedemptionAllowed: false,
  couponFrequency: 0,
  description: '',
};

const ROR_PRESET: BondPreset = {
  id: 'ROR',
  name: 'ROR (roczne)',
  maturityMonths: 12,
  rateType: 'reference',
  firstYearRate: 6,
  margin: 0,
  earlyRedemptionPenalty: 0.5,
  earlyRedemptionAllowed: true,
  couponFrequency: 12,
  description: '',
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('calcBondHoldingCurrentValue', () => {
  it('TestCalcBondHoldingCurrentValue_WhenZeroMonthsElapsed_ExpectsPrincipalUnchanged', () => {
    const holding: BondHolding = {
      id: '1', assetClass: 'bond', bondPresetId: 'OTS', principal: 1000,
      purchaseDate: daysAgoIso(0), source: 'manual', addedAt: '', updatedAt: '',
    };
    expect(calcBondHoldingCurrentValue(holding, OTS_PRESET)).toBeCloseTo(1000, 0);
  });

  it('TestCalcBondHoldingCurrentValue_WhenCapitalizedBondHeldSixMonths_ExpectsGrowth', () => {
    const holding: BondHolding = {
      id: '1', assetClass: 'bond', bondPresetId: 'OTS', principal: 1000,
      purchaseDate: daysAgoIso(182), source: 'manual', addedAt: '', updatedAt: '',
    };
    const value = calcBondHoldingCurrentValue(holding, OTS_PRESET);
    expect(value).toBeGreaterThan(1000);
  });

  it('TestCalcBondHoldingCurrentValue_WhenCouponBondHeldOverAYear_ExpectsGrowth', () => {
    const holding: BondHolding = {
      id: '1', assetClass: 'bond', bondPresetId: 'ROR', principal: 1000,
      purchaseDate: daysAgoIso(400), source: 'manual', addedAt: '', updatedAt: '',
    };
    const value = calcBondHoldingCurrentValue(holding, ROR_PRESET);
    expect(value).toBeGreaterThan(1000);
  });
});

describe('calcSavingsHoldingCurrentValue', () => {
  it('TestCalcSavingsHoldingCurrentValue_WhenZeroMonthsElapsed_ExpectsPrincipalUnchanged', () => {
    const holding: SavingsHolding = {
      id: '1', assetClass: 'savings', bankName: 'Toyota Bank', principal: 5000,
      interestRatePercent: 4, asOfDate: daysAgoIso(0), source: 'manual', addedAt: '', updatedAt: '',
    };
    expect(calcSavingsHoldingCurrentValue(holding)).toBeCloseTo(5000, 0);
  });

  it('TestCalcSavingsHoldingCurrentValue_WhenHeldOneYear_ExpectsCompoundGrowth', () => {
    const holding: SavingsHolding = {
      id: '1', assetClass: 'savings', bankName: 'Toyota Bank', principal: 5000,
      interestRatePercent: 4, asOfDate: daysAgoIso(365), source: 'manual', addedAt: '', updatedAt: '',
    };
    const value = calcSavingsHoldingCurrentValue(holding);
    // (1 + 0.04/12)^12 ≈ 1.0407
    expect(value).toBeGreaterThan(5150);
    expect(value).toBeLessThan(5250);
  });

  it('TestCalcSavingsHoldingCurrentValue_WhenZeroRate_ExpectsPrincipalUnchanged', () => {
    const holding: SavingsHolding = {
      id: '1', assetClass: 'savings', bankName: 'Toyota Bank', principal: 5000,
      interestRatePercent: 0, asOfDate: daysAgoIso(365), source: 'manual', addedAt: '', updatedAt: '',
    };
    expect(calcSavingsHoldingCurrentValue(holding)).toBeCloseTo(5000, 0);
  });
});

describe('calcTermDepositHoldingCurrentValue', () => {
  it('TestCalcTermDepositHoldingCurrentValue_WhenZeroMonthsElapsed_ExpectsPrincipalUnchanged', () => {
    const holding: TermDepositHolding = {
      id: '1', assetClass: 'termDeposit', bankName: 'mBank', principal: 10000, interestRatePercent: 5,
      openDate: daysAgoIso(0), maturityDate: daysFromNowIso(365), source: 'manual', addedAt: '', updatedAt: '',
    };
    const value = calcTermDepositHoldingCurrentValue(holding);
    expect(value).toBeGreaterThanOrEqual(10000);
    expect(value).toBeLessThan(10010);
  });

  it('TestCalcTermDepositHoldingCurrentValue_WhenMidTerm_ExpectsCompoundGrowth', () => {
    const holding: TermDepositHolding = {
      id: '1', assetClass: 'termDeposit', bankName: 'mBank', principal: 10000, interestRatePercent: 5,
      openDate: daysAgoIso(180), maturityDate: daysFromNowIso(180), source: 'manual', addedAt: '', updatedAt: '',
    };
    expect(calcTermDepositHoldingCurrentValue(holding)).toBeGreaterThan(10000);
  });

  it('TestCalcTermDepositHoldingCurrentValue_WhenPastMaturity_ExpectsValueCappedAtMaturityDate', () => {
    const openDate = daysAgoIso(400);
    const maturityDate = daysAgoIso(35);
    const holding: TermDepositHolding = {
      id: '1', assetClass: 'termDeposit', bankName: 'mBank', principal: 10000, interestRatePercent: 5,
      openDate, maturityDate, source: 'manual', addedAt: '', updatedAt: '',
    };
    const valueAtMaturity = calcTermDepositHoldingCurrentValue(holding, new Date(maturityDate).getTime());
    const valueLongAfterMaturity = calcTermDepositHoldingCurrentValue(holding, Date.now());
    expect(valueLongAfterMaturity).toBeCloseTo(valueAtMaturity, 6);
  });
});
