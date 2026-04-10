import type { BenchmarkType, BondSettings, Scenarios } from '../types/scenario';

const STORAGE_KEY = 'njord_state';
const SCHEMA_VERSION = 1;

export interface PersistedState {
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
  brokerFeeUSD: number;
}

export function loadState(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // Discard data from incompatible schema versions
    if (parsed._v !== SCHEMA_VERSION) return null;
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
