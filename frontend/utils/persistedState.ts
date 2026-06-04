import type { BenchmarkType, BondSettings, Scenarios } from '../types/scenario';
import type { CalcInputs } from './calculations';

const STORAGE_KEY = 'njord_state';
const SCHEMA_VERSION = 6;
const COMPARISON_ANALYSIS_KEY = 'njord_comparison_analysis';
const COMPARISON_ANALYSIS_SCHEMA_VERSION = 1;

interface PersistedState {
  _v: number;
  ticker: string;
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  wibor3m: number;
  inflationRate: number;
  nbpRefRate: number;
  bondSettings: BondSettings;
  bondPresetId: string;
  horizonMonths: number;
  benchmarkType: BenchmarkType;
  userScenarios: Scenarios | null;
  avgCostUSD: number;
  isRSU: boolean;
  brokerFeeUSD: number;
  dividendYieldPercent: number;
  etfAnnualReturnPercent: number;
  etfTerPercent: number;
  etfTicker: string;
}

export interface PersistedComparisonTraitStats {
  stockSigmaAnnual: number;
  fxSigmaAnnual: number;
  correlation: number;
}

export interface PersistedComparisonAnalysis {
  inputs: CalcInputs;
  scenarios: Scenarios;
  signature: string;
  assetLabel: string;
  ticker: string;
  traitStats: PersistedComparisonTraitStats | null;
}

interface PersistedComparisonAnalysisRecord extends PersistedComparisonAnalysis {
  _v: number;
}

export function loadState(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState & { activeSection?: string };
    // Accept current and previous schema versions
    if (parsed._v !== SCHEMA_VERSION && parsed._v !== 5 && parsed._v !== 4 && parsed._v !== 3 && parsed._v !== 2 && parsed._v !== 1) return null;
    // Migration: v2 → v3 — add maturityMonths to bondSettings, add isRSU
    if ((parsed._v === 1 || parsed._v === 2) && parsed.bondSettings && !('maturityMonths' in parsed.bondSettings)) {
      (parsed.bondSettings as BondSettings).maturityMonths = 12;
    }
    if ((parsed._v === 1 || parsed._v === 2) && !('isRSU' in parsed)) {
      (parsed as PersistedState).isRSU = false;
    }
    // Migration: v4 → v5 — activeSection removed (route persistence is now in Layout via njord_last_route)
    // Old activeSection values are migrated to the new njord_last_route key if not already set.
    if (parsed._v <= 4 && parsed.activeSection) {
      try {
        if (!localStorage.getItem('njord_last_route')) {
          const routeMap: Record<string, string> = { investment: '/comparison', tax: '/tax', portfolio: '/portfolio' };
          const route = routeMap[parsed.activeSection] ?? '/';
          localStorage.setItem('njord_last_route', route);
        }
      } catch { /* ignore */ }
      delete parsed.activeSection;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: Omit<PersistedState, '_v'>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _v: SCHEMA_VERSION }));
  } catch {
    // localStorage unavailable or quota exceeded — ignore silently
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable or quota exceeded — ignore silently
  }
}

export function loadComparisonAnalysis(): PersistedComparisonAnalysis | null {
  try {
    const raw = localStorage.getItem(COMPARISON_ANALYSIS_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersistedComparisonAnalysisRecord;
    if (parsed._v !== COMPARISON_ANALYSIS_SCHEMA_VERSION) return null;

    return {
      inputs: parsed.inputs,
      scenarios: parsed.scenarios,
      signature: parsed.signature,
      assetLabel: parsed.assetLabel,
      ticker: parsed.ticker,
      traitStats: parsed.traitStats,
    };
  } catch {
    return null;
  }
}

export function saveComparisonAnalysis(analysis: PersistedComparisonAnalysis): void {
  try {
    localStorage.setItem(
      COMPARISON_ANALYSIS_KEY,
      JSON.stringify({ ...analysis, _v: COMPARISON_ANALYSIS_SCHEMA_VERSION }),
    );
  } catch {
    // localStorage unavailable or quota exceeded — ignore silently
  }
}

export function clearComparisonAnalysis(): void {
  try {
    localStorage.removeItem(COMPARISON_ANALYSIS_KEY);
  } catch {
    // localStorage unavailable or quota exceeded — ignore silently
  }
}
