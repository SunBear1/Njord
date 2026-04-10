import type { RegimeInfo } from '../utils/hmm';

export interface FanChartPoint {
  day: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface DistributionStats {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface TouchResult {
  target: number;
  pTouch: number;
}

export interface SellTarget {
  target: number;
  pTouch: number;
  expectedValue: number;
  riskOfForcedSale: number; // P(final price < current price)
}

export interface SellAnalysisResult {
  currentPrice: number;
  horizonDays: number;
  fanChart: FanChartPoint[];
  peakDistribution: DistributionStats;
  peakTimingDistribution: DistributionStats;
  finalPriceDistribution: DistributionStats;
  touchProbabilities: TouchResult[];
  expectedSellPrices: SellTarget[];
  optimalTarget: SellTarget;
  medianFinalPrice: number;
  riskOfForcedSale: number;
  regimeInfo: RegimeInfo;
}
