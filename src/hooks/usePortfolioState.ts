/**
 * usePortfolioState — encapsulates all portfolio input state, persistence,
 * autofill effects, and scenario handlers for the investment comparison tab.
 *
 * Accepts external async data (currency rates, inflation, ETF returns, FX proxy)
 * to drive one-time autofill without exposing mutable refs to callers.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BenchmarkType, BondSettings, ScenarioKey, Scenarios } from '../types/scenario';
import { clearState, loadState, saveState } from '../utils/persistedState';
import { DEFAULT_HORIZON_MONTHS } from '../utils/assetConfig';

const DEFAULT_BOND_SETTINGS: BondSettings = {
  firstYearRate: 0,
  penalty: 0,
  rateType: 'fixed',
  margin: 0,
  couponFrequency: 0,
  maturityMonths: 12,
};

const DEFAULT_SCENARIOS: Scenarios = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

export interface AutofillSources {
  aliorBuyRate: number | null;
  proxyFxRate: number | null;
  inflationCurrentRate: number | null;
  etfAnnualizedReturn: number | null;
}

export interface PortfolioState {
  savedAt: number;
  ticker: string;
  setTicker: (value: string) => void;
  shares: number;
  setShares: (value: number) => void;
  currentPriceUSD: number;
  setCurrentPriceUSD: (value: number) => void;
  currentFxRate: number;
  setCurrentFxRate: (value: number) => void;
  wibor3m: number;
  setWibor3m: (value: number) => void;
  benchmarkType: BenchmarkType;
  nbpRefRate: number;
  setNbpRefRate: (value: number) => void;
  horizonMonths: number;
  setHorizonMonths: (value: number) => void;
  avgCostUSD: number;
  setAvgCostUSD: (value: number) => void;
  isRSU: boolean;
  setIsRSU: (value: boolean) => void;
  brokerFeeUSD: number;
  setBrokerFeeUSD: (value: number) => void;
  dividendYieldPercent: number;
  setDividendYieldPercent: (value: number) => void;
  bondSettings: BondSettings;
  setBondSettings: (value: BondSettings) => void;
  bondPresetId: string;
  setBondPresetId: (value: string) => void;
  etfAnnualReturnPercent: number;
  setEtfAnnualReturnPercent: (value: number) => void;
  etfTerPercent: number;
  setEtfTerPercent: (value: number) => void;
  etfTicker: string;
  setEtfTicker: (value: string) => void;
  inflationRate: number;
  setInflationRate: (value: number) => void;
  userScenarios: Scenarios | null;
  setUserScenarios: (value: Scenarios | null) => void;
  scenarioEditKey: number;
  setScenarioEditKey: (updater: (value: number) => number) => void;
  resetForNewTicker: () => void;
  resetEtfAutofill: () => void;
  resetComparisonState: () => void;
  handleScenarioChange: (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => void;
  handleBenchmarkTypeChange: (value: BenchmarkType) => void;
  handleApplySuggested: (suggestedScenarios: Scenarios | null) => void;
  handleApplyModelScenarios: (scenarios: Scenarios) => void;
}

export function usePortfolioState(autofill: AutofillSources): PortfolioState {
  const [saved] = useState(loadState);

  const [savedAt, setSavedAt] = useState(0);
  const [ticker, setTicker] = useState(saved?.ticker ?? '');
  const [shares, setShares] = useState(saved?.shares ?? 0);
  const [currentPriceUSD, setCurrentPriceUSD] = useState(saved?.currentPriceUSD ?? 0);
  const [currentFxRate, setCurrentFxRate] = useState(saved?.currentFxRate ?? 0);
  const [wibor3m, setWibor3m] = useState(saved?.wibor3m ?? 0);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>(saved?.benchmarkType ?? 'savings');
  const [bondSettings, setBondSettings] = useState<BondSettings>(saved?.bondSettings ?? DEFAULT_BOND_SETTINGS);
  const [bondPresetId, setBondPresetId] = useState(saved?.bondPresetId ?? 'OTS');
  const [inflationRate, setInflationRate] = useState(saved?.inflationRate ?? 0);
  const [nbpRefRate, setNbpRefRate] = useState(saved?.nbpRefRate ?? 0);
  const [horizonMonths, setHorizonMonths] = useState(saved?.horizonMonths ?? DEFAULT_HORIZON_MONTHS);
  const [avgCostUSD, setAvgCostUSD] = useState(saved?.avgCostUSD ?? 0);
  const [isRSU, setIsRSU] = useState(saved?.isRSU ?? false);
  const [brokerFeeUSD, setBrokerFeeUSD] = useState(saved?.brokerFeeUSD ?? 0);
  const [dividendYieldPercent, setDividendYieldPercent] = useState(saved?.dividendYieldPercent ?? 0);
  const [etfAnnualReturnPercent, setEtfAnnualReturnPercent] = useState(saved?.etfAnnualReturnPercent ?? 8);
  const [etfTerPercent, setEtfTerPercent] = useState(saved?.etfTerPercent ?? 0);
  const [etfTicker, setEtfTicker] = useState(saved?.etfTicker ?? 'IWDA.L');
  const [userScenarios, setUserScenarios] = useState<Scenarios | null>(saved?.userScenarios ?? null);
  const [scenarioEditKey, setScenarioEditKey] = useState(0);

  const fxAutoFilledRef = useRef(false);
  const aliorAutoFilledRef = useRef(false);
  const inflationAutoFilledRef = useRef(false);
  const etfReturnAutoFilledRef = useRef(false);

  useEffect(() => {
    if (autofill.aliorBuyRate && !aliorAutoFilledRef.current) {
      aliorAutoFilledRef.current = true;
      fxAutoFilledRef.current = true;
      setCurrentFxRate(autofill.aliorBuyRate);
    }
  }, [autofill.aliorBuyRate]);

  useEffect(() => {
    if (autofill.proxyFxRate && !fxAutoFilledRef.current) {
      fxAutoFilledRef.current = true;
      setCurrentFxRate(autofill.proxyFxRate);
    }
  }, [autofill.proxyFxRate]);

  useEffect(() => {
    if (autofill.inflationCurrentRate && !inflationAutoFilledRef.current) {
      inflationAutoFilledRef.current = true;
      setInflationRate(autofill.inflationCurrentRate);
    }
  }, [autofill.inflationCurrentRate]);

  useEffect(() => {
    if (autofill.etfAnnualizedReturn !== null && !etfReturnAutoFilledRef.current) {
      etfReturnAutoFilledRef.current = true;
      setEtfAnnualReturnPercent(parseFloat(autofill.etfAnnualizedReturn.toFixed(2)));
    }
  }, [autofill.etfAnnualizedReturn]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({
        ticker,
        shares,
        currentPriceUSD,
        currentFxRate,
        wibor3m,
        inflationRate,
        nbpRefRate,
        bondSettings,
        bondPresetId,
        horizonMonths,
        benchmarkType,
        userScenarios,
        avgCostUSD,
        isRSU,
        brokerFeeUSD,
        dividendYieldPercent,
        etfAnnualReturnPercent,
        etfTerPercent,
        etfTicker,
      });
      setSavedAt(Date.now());
    }, 600);

    return () => clearTimeout(timer);
  }, [
    ticker,
    shares,
    currentPriceUSD,
    currentFxRate,
    wibor3m,
    inflationRate,
    nbpRefRate,
    bondSettings,
    bondPresetId,
    horizonMonths,
    benchmarkType,
    userScenarios,
    avgCostUSD,
    isRSU,
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent,
    etfTicker,
  ]);

  const resetForNewTicker = useCallback(() => {
    fxAutoFilledRef.current = false;
    setUserScenarios(null);
    setScenarioEditKey((value) => value + 1);
  }, []);

  const resetEtfAutofill = useCallback(() => {
    etfReturnAutoFilledRef.current = false;
  }, []);

  const resetComparisonState = useCallback(() => {
    clearState();
    fxAutoFilledRef.current = false;
    aliorAutoFilledRef.current = false;
    inflationAutoFilledRef.current = false;
    etfReturnAutoFilledRef.current = false;

    setSavedAt(0);
    setTicker('');
    setShares(0);
    setCurrentPriceUSD(0);
    setCurrentFxRate(0);
    setWibor3m(0);
    setBenchmarkType('savings');
    setBondSettings(DEFAULT_BOND_SETTINGS);
    setBondPresetId('OTS');
    setInflationRate(0);
    setNbpRefRate(0);
    setHorizonMonths(DEFAULT_HORIZON_MONTHS);
    setAvgCostUSD(0);
    setIsRSU(false);
    setBrokerFeeUSD(0);
    setDividendYieldPercent(0);
    setEtfAnnualReturnPercent(8);
    setEtfTerPercent(0);
    setEtfTicker('IWDA.L');
    setUserScenarios(null);
    setScenarioEditKey((value) => value + 1);
  }, []);

  const handleScenarioChange = useCallback(
    (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => {
      setUserScenarios((previous) => {
        const base = previous ?? DEFAULT_SCENARIOS;
        return { ...base, [key]: { ...base[key], [field]: value } };
      });
    },
    [],
  );

  const handleBenchmarkTypeChange = useCallback((value: BenchmarkType) => {
    setBenchmarkType(value);
    if (value === 'savings') {
      setHorizonMonths((previous) => Math.min(previous, 60));
    }
  }, []);

  const handleApplySuggested = useCallback((suggestedScenarios: Scenarios | null) => {
    if (!suggestedScenarios) return;
    setUserScenarios(suggestedScenarios);
    setScenarioEditKey((value) => value + 1);
  }, []);

  const handleApplyModelScenarios = useCallback((scenarios: Scenarios) => {
    setUserScenarios(scenarios);
  }, []);

  return {
    savedAt,
    ticker, setTicker,
    shares, setShares,
    currentPriceUSD, setCurrentPriceUSD,
    currentFxRate, setCurrentFxRate,
    wibor3m, setWibor3m,
    benchmarkType,
    nbpRefRate, setNbpRefRate,
    horizonMonths, setHorizonMonths,
    avgCostUSD, setAvgCostUSD,
    isRSU, setIsRSU,
    brokerFeeUSD, setBrokerFeeUSD,
    dividendYieldPercent, setDividendYieldPercent,
    bondSettings, setBondSettings,
    bondPresetId, setBondPresetId,
    etfAnnualReturnPercent, setEtfAnnualReturnPercent,
    etfTerPercent, setEtfTerPercent,
    etfTicker, setEtfTicker,
    inflationRate, setInflationRate,
    userScenarios, setUserScenarios,
    scenarioEditKey, setScenarioEditKey,
    resetForNewTicker,
    resetEtfAutofill,
    resetComparisonState,
    handleScenarioChange,
    handleBenchmarkTypeChange,
    handleApplySuggested,
    handleApplyModelScenarios,
  };
}
