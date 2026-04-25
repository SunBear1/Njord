import type { BenchmarkType, BondSettings, Scenarios } from '../types/scenario';

const STORAGE_KEY = 'njord_state';
const SCHEMA_VERSION = 4;

interface PersistedState {
  _v: number;
  ticker: string;
  shares: number;
  wibor3m: number;
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
  activeSection: string;
}

export function loadState(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Accept current and previous schema versions
    if (parsed._v !== SCHEMA_VERSION && parsed._v !== 3 && parsed._v !== 2 && parsed._v !== 1) return null;
    // Migration: v1 → v2 — add activeSection default
    if (parsed._v === 1) {
      parsed.activeSection = 'investment';
    }
    // Migration: v2 → v3 — add maturityMonths to bondSettings, add isRSU
    if ((parsed._v === 1 || parsed._v === 2) && parsed.bondSettings && !('maturityMonths' in parsed.bondSettings)) {
      (parsed.bondSettings as BondSettings).maturityMonths = 12;
    }
    if ((parsed._v === 1 || parsed._v === 2) && !('isRSU' in parsed)) {
      (parsed as PersistedState).isRSU = false;
    }
    // Migration: v3 → v4 — rename activeSection 'accumulation' to 'portfolio'
    if (parsed._v <= 3 && parsed.activeSection === 'accumulation') {
      parsed.activeSection = 'portfolio';
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
