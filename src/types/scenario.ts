export type ScenarioKey = 'bear' | 'base' | 'bull';

export interface ScenarioParams {
  deltaStock: number; // % change in stock price (e.g. -10 means -10%)
  deltaFx: number;    // % change in USD/PLN rate (e.g. 5 means +5%)
}

export type Scenarios = Record<ScenarioKey, ScenarioParams>;

export type BenchmarkType = 'savings' | 'bonds' | 'etf';

export type BondRateType = 'fixed' | 'reference' | 'inflation';

export interface BondSettings {
  firstYearRate: number;    // % for first year/period
  penalty: number;          // early redemption penalty % of principal
  rateType: BondRateType;
  margin: number;           // added to base rate for years 2+
  couponFrequency: number;  // payments/year: 0=capitalized, 1=annual, 12=monthly
}

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
  // Cost basis P&L (present only when avgCostUSD > 0)
  costBasisValuePLN: number;     // purchase value at current NBP rate: shares × avgCostUSD × nbpRate
  unrealizedGainPLN: number;     // currentValuePLN − costBasisValuePLN (negative = loss)
  unrealizedGainPercent: number; // unrealizedGainPLN / costBasisValuePLN × 100
  belkaTaxedFromCostBasis: boolean; // true = Belka applies to sale above cost basis (not just today)
  // Dividend income
  dividendsNetPLN: number;       // net dividend income after 19% Belka (0 if no yield set)
}
