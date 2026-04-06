export type ScenarioKey = 'bear' | 'base' | 'bull';

export interface ScenarioParams {
  deltaStock: number; // % change in stock price (e.g. -10 means -10%)
  deltaFx: number;    // % change in USD/PLN rate (e.g. 5 means +5%)
}

export type Scenarios = Record<ScenarioKey, ScenarioParams>;

export type BenchmarkType = 'savings' | 'bonds';

export interface BondPreset {
  id: string;
  name: string;
  maturityMonths: number;
  annualRate: number; // in %, e.g. 5.75
  earlyRedemptionPenalty: number; // in % of principal
  description: string;
}

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  currentValuePLN: number;
  stockRawEndValuePLN: number;
  stockNetEndValuePLN: number;
  benchmarkEndValuePLN: number;
  stockBeatsBenchmark: boolean;
  differencePLN: number;
  differencePercent: number;
  stockReturnNet: number;
  benchmarkReturnNet: number;
  benchmarkLabel: string;
}
