import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearComparisonAnalysis,
  loadComparisonAnalysis,
  saveComparisonAnalysis,
  type PersistedComparisonAnalysis,
} from '../utils/persistedState';

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function createAnalysis(): PersistedComparisonAnalysis {
  return {
    inputs: {
      shares: 10,
      currentPriceUSD: 150,
      currentFxRate: 4.1,
      nbpMidRate: 4.0,
      horizonMonths: 12,
      benchmarkType: 'etf',
      wibor3mPercent: 5.5,
      bondFirstYearRate: 0,
      bondEffectiveRate: 0,
      bondPenaltyPercent: 0,
      bondCouponFrequency: 0,
      bondReinvestmentRate: 5.5,
      bondMaturityMonths: 12,
      inflationRate: 3.5,
      avgCostUSD: 100,
      isRSU: false,
      brokerFeeUSD: 0,
      dividendYieldPercent: 0,
      etfAnnualReturnPercent: 8,
      etfTerPercent: 0,
    },
    scenarios: {
      bear: { deltaStock: -10, deltaFx: -5 },
      base: { deltaStock: 0, deltaFx: 0 },
      bull: { deltaStock: 10, deltaFx: 5 },
    },
    signature: '{"ticker":"AAPL"}',
    assetLabel: 'Apple Inc.',
    ticker: 'AAPL',
    traitStats: {
      stockSigmaAnnual: 24.5,
      fxSigmaAnnual: 7.2,
      correlation: -0.35,
    },
  };
}

describe('persistedState', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('TestSaveComparisonAnalysis_WhenSnapshotIsStored_ExpectsLoadComparisonAnalysisToReturnIt', () => {
    const analysis = createAnalysis();

    saveComparisonAnalysis(analysis);

    expect(loadComparisonAnalysis()).toEqual(analysis);
  });

  it('TestClearComparisonAnalysis_WhenSnapshotWasStored_ExpectsLoadComparisonAnalysisToReturnNull', () => {
    saveComparisonAnalysis(createAnalysis());

    clearComparisonAnalysis();

    expect(loadComparisonAnalysis()).toBeNull();
  });
});
