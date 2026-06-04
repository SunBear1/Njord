export interface FxRate {
  date: string;
  rate: number;
}

export interface FxData {
  currentRate: number;
  historicalRates: FxRate[];
}
