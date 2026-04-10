export type ScenarioKey = 'bear' | 'base' | 'bull';

export interface ScenarioParams {
  deltaStock: number; // % change in stock price (e.g. -10 means -10%)
  deltaFx: number;    // % change in USD/PLN rate (e.g. 5 means +5%)
}

export type Scenarios = Record<ScenarioKey, ScenarioParams>;

export type BenchmarkType = 'savings' | 'bonds';

export type BondRateType = 'fixed' | 'reference' | 'inflation';

export interface BondPreset {
  id: string;
  name: string;
  maturityMonths: number;
  rateType: BondRateType;
  firstYearRate: number;          // % for first year/period (promotional)
  margin: number;                 // added to base rate (NBP ref or inflation) for years 2+
  earlyRedemptionPenalty: number; // in % of principal (PLN per 100 PLN unit)
  earlyRedemptionAllowed: boolean; // false for OTS (too short) and TOS (locked)
  couponFrequency: number;        // coupon payments/year: 0=capitalized at maturity, 1=annual, 12=monthly
  description: string;
  isFamily?: boolean;             // 800+ beneficiaries only
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
  // Inflation-adjusted (real) returns
  stockRealReturnNet: number;
  benchmarkRealReturnNet: number;
  inflationTotalPercent: number; // cumulative inflation over horizon
}
