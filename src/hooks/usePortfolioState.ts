/**
 * usePortfolioState — encapsulates all portfolio input state, persistence,
 * autofill effects, and scenario handlers for the investment comparison tab.
 *
 * Accepts external async data (currency rates, inflation, ETF returns, FX proxy)
 * to drive one-time autofill without exposing mutable refs to callers.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { BenchmarkType, BondSettings, ScenarioKey, Scenarios } from '../types/scenario';
import { loadState, saveState } from '../utils/persistedState';
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
  /** Alior Kantor buy rate for USD/PLN — primary autofill */
  aliorBuyRate: number | null;
  /** Proxy FX rate from the stock data endpoint — fallback autofill */
  proxyFxRate: number | null;
  /** ECB inflation rate for Poland */
  inflationCurrentRate: number | null;
  /** Historical CAGR from the ETF data endpoint */
  etfAnnualizedReturn: number | null;
}

export interface PortfolioState {
  // Inputs
  ticker: string;
  setTicker: (v: string) => void;
  shares: number;
  setShares: (v: number) => void;
  currentPriceUSD: number;
  setCurrentPriceUSD: (v: number) => void;
  currentFxRate: number;
  setCurrentFxRate: (v: number) => void;
  wibor3m: number;
  setWibor3m: (v: number) => void;
  benchmarkType: BenchmarkType;
  nbpRefRate: number;
  setNbpRefRate: (v: number) => void;
  horizonMonths: number;
  setHorizonMonths: (v: number) => void;
  avgCostUSD: number;
  setAvgCostUSD: (v: number) => void;
  isRSU: boolean;
  setIsRSU: (v: boolean) => void;
  brokerFeeUSD: number;
  setBrokerFeeUSD: (v: number) => void;
  dividendYieldPercent: number;
  setDividendYieldPercent: (v: number) => void;
  bondSettings: BondSettings;
  setBondSettings: (v: BondSettings) => void;
  bondPresetId: string;
  setBondPresetId: (v: string) => void;
  etfAnnualReturnPercent: number;
  setEtfAnnualReturnPercent: (v: number) => void;
  etfTerPercent: number;
  setEtfTerPercent: (v: number) => void;
  etfTicker: string;
  setEtfTicker: (v: string) => void;
  inflationRate: number;
  setInflationRate: (v: number) => void;
  userScenarios: Scenarios | null;
  setUserScenarios: (v: Scenarios | null) => void;
  scenarioEditKey: number;
  setScenarioEditKey: (updater: (k: number) => number) => void;
  /** Call when a new stock ticker is fetched to reset scenarios + FX autofill */
  resetForNewTicker: () => void;
  /** Call when a new ETF ticker is fetched to allow re-autofill of ETF return */
  resetEtfAutofill: () => void;
  // Handlers
  handleScenarioChange: (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => void;
  handleBenchmarkTypeChange: (v: BenchmarkType) => void;
  handleApplySuggested: (suggestedScenarios: Scenarios | null) => void;
  handleApplyModelScenarios: (s: Scenarios) => void;
}

export function usePortfolioState(
  activeSection: string,
  autofill: AutofillSources,
): PortfolioState {
  const saved = loadState();

  const [ticker, setTicker] = useState(saved?.ticker ?? '');
  const [shares, setShares] = useState(saved?.shares ?? 0);
  const [currentPriceUSD, setCurrentPriceUSD] = useState(0);
  const [currentFxRate, setCurrentFxRate] = useState(0);
  const [wibor3m, setWibor3m] = useState(saved?.wibor3m ?? 0);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>(saved?.benchmarkType ?? 'savings');
  const [bondSettings, setBondSettings] = useState<BondSettings>(saved?.bondSettings ?? DEFAULT_BOND_SETTINGS);
  const [bondPresetId, setBondPresetId] = useState(saved?.bondPresetId ?? 'OTS');
  const [inflationRate, setInflationRate] = useState(0);
  const [nbpRefRate, setNbpRefRate] = useState(saved?.nbpRefRate ?? 0);
  const [horizonMonths, setHorizonMonths] = useState(saved?.horizonMonths ?? DEFAULT_HORIZON_MONTHS);
  const [avgCostUSD, setAvgCostUSD] = useState(saved?.avgCostUSD ?? 0);
  const [isRSU, setIsRSU] = useState(saved?.isRSU ?? false);
  const [brokerFeeUSD, setBrokerFeeUSD] = useState(saved?.brokerFeeUSD ?? 0);
  const [dividendYieldPercent, setDividendYieldPercent] = useState(saved?.dividendYieldPercent ?? 0);
  const [etfAnnualReturnPercent, setEtfAnnualReturnPercent] = useState(saved?.etfAnnualReturnPercent ?? 8);
  const [etfTerPercent, setEtfTerPercent] = useState(saved?.etfTerPercent ?? 0.07);
  const [etfTicker, setEtfTicker] = useState(saved?.etfTicker ?? 'IWDA.L');
  const [userScenarios, setUserScenarios] = useState<Scenarios | null>(saved?.userScenarios ?? null);
  const [scenarioEditKey, setScenarioEditKey] = useState(0);

  // Autofill guard refs — track whether each source has already been applied.
  // Mutable refs are kept private to the hook (not exposed) to comply with
  // the react-hooks/immutability lint rule.
  const fxAutoFilledRef = useRef(false);
  const aliorAutoFilledRef = useRef(false);
  const inflationAutoFilledRef = useRef(false);
  const etfReturnAutoFilledRef = useRef(false);

  // Primary FX autofill: Alior Kantor buy rate
  useEffect(() => {
    if (autofill.aliorBuyRate && !aliorAutoFilledRef.current) {
      aliorAutoFilledRef.current = true;
      fxAutoFilledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setCurrentFxRate(autofill.aliorBuyRate);
    }
  }, [autofill.aliorBuyRate]);

  // Fallback FX autofill: proxy FX rate from stock data endpoint
  useEffect(() => {
    if (autofill.proxyFxRate && !fxAutoFilledRef.current) {
      fxAutoFilledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setCurrentFxRate(autofill.proxyFxRate);
    }
  }, [autofill.proxyFxRate]);

  // Inflation autofill: ECB HICP current rate
  useEffect(() => {
    if (autofill.inflationCurrentRate && !inflationAutoFilledRef.current) {
      inflationAutoFilledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setInflationRate(autofill.inflationCurrentRate);
    }
  }, [autofill.inflationCurrentRate]);

  // ETF return autofill: historical CAGR from ETF data endpoint
  useEffect(() => {
    if (autofill.etfAnnualizedReturn !== null && !etfReturnAutoFilledRef.current) {
      etfReturnAutoFilledRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setEtfAnnualReturnPercent(parseFloat(autofill.etfAnnualizedReturn.toFixed(2)));
    }
  }, [autofill.etfAnnualizedReturn]);

  // Persist to localStorage with 600ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({
        ticker, shares, wibor3m, nbpRefRate, bondSettings, bondPresetId,
        horizonMonths, benchmarkType, userScenarios, avgCostUSD, isRSU,
        brokerFeeUSD, dividendYieldPercent, etfAnnualReturnPercent,
        etfTerPercent, etfTicker, activeSection,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [
    ticker, shares, wibor3m, nbpRefRate, bondSettings, bondPresetId,
    horizonMonths, benchmarkType, userScenarios, avgCostUSD, isRSU,
    brokerFeeUSD, dividendYieldPercent, etfAnnualReturnPercent,
    etfTerPercent, etfTicker, activeSection,
  ]);

  const resetForNewTicker = useCallback(() => {
    fxAutoFilledRef.current = false;
    setUserScenarios(null);
    setScenarioEditKey((k) => k + 1);
  }, []);

  const resetEtfAutofill = useCallback(() => {
    etfReturnAutoFilledRef.current = false;
  }, []);

  const handleScenarioChange = useCallback(
    (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => {
      setUserScenarios((prev) => {
        const base = prev ?? DEFAULT_SCENARIOS;
        return { ...base, [key]: { ...base[key], [field]: value } };
      });
    },
    [],
  );

  const handleBenchmarkTypeChange = useCallback((v: BenchmarkType) => {
    setBenchmarkType(v);
    if (v === 'savings') {
      setHorizonMonths((prev) => Math.min(prev, 60));
    }
  }, []);

  const handleApplySuggested = useCallback((suggestedScenarios: Scenarios | null) => {
    if (suggestedScenarios) {
      setUserScenarios(suggestedScenarios);
      setScenarioEditKey((k) => k + 1);
    }
  }, []);

  const handleApplyModelScenarios = useCallback((s: Scenarios) => {
    setUserScenarios(s);
  }, []);

  return {
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
    handleScenarioChange,
    handleBenchmarkTypeChange,
    handleApplySuggested,
    handleApplyModelScenarios,
  };
}
