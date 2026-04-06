export type ScenarioKey = 'bear' | 'base' | 'bull';

export interface ScenarioParams {
  deltaStock: number; // % change in stock price (e.g. -10 means -10%)
  deltaFx: number;    // % change in USD/PLN rate (e.g. 5 means +5%)
}

export type Scenarios = Record<ScenarioKey, ScenarioParams>;

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
  stockReturnNet: number;
  savingsReturnNet: number;
}
