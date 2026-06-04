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
  /** 'upside' — probability price rises to or above target at any point.
   *  'downside' — probability price drops to or below target at any point. */
  type: 'upside' | 'downside';
  /** Mean number of trading days until the target is first touched (0 when pTouch = 0). */
  meanTouchDay: number;
}

export interface SellTarget {
  target: number;
  pTouch: number;
  expectedValue: number;
  riskOfForcedSale: number; // P(final price < current price)
  /** Mean number of trading days until the target is first touched (from TouchResult). */
  meanTouchDay: number;
  /** Type of touch direction, propagated from TouchResult. */
  type: 'upside' | 'downside';
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
