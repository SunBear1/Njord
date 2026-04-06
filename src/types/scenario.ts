export type ScenarioKey = 'bear' | 'base' | 'bull';

export interface ScenarioParams {
  deltaStock: number; // % change in stock price (e.g. -10 means -10%)
  deltaFx: number;    // % change in USD/PLN rate (e.g. 5 means +5%)
}

export type Scenarios = Record<ScenarioKey, ScenarioParams>;

export interface ScenarioMeta {
  key: ScenarioKey;
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  borderColor: string;
}

export const SCENARIO_META: ScenarioMeta[] = [
  { key: 'bear', label: 'Bear 🐻', emoji: '🐻', color: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  { key: 'base', label: 'Base ⚖️', emoji: '⚖️', color: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  { key: 'bull', label: 'Bull 🐂', emoji: '🐂', color: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
];

export interface ScenarioResult {
  key: ScenarioKey;
  label: string;
  currentValuePLN: number;
  stockRawEndValuePLN: number;
  stockNetEndValuePLN: number;
  savingsEndValuePLN: number;
  stockBeatsSavings: boolean;
  differencePLN: number;
  differencePercent: number;
  stockReturnNet: number;    // net % return on stocks
  savingsReturnNet: number;  // net % return on savings
}
