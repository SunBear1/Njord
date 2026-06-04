import type { Position } from '../types/position';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export type QualityTier = 'complete' | 'incomplete' | 'unknown';

export interface PositionQuality {
  score: number; // 0-100
  tier: QualityTier;
  isStale: boolean;
  missingFields: string[];
}

export interface PortfolioQuality {
  overallScore: number; // 0-100 rounded integer
  staleCount: number;
  completeCount: number;
  totalCount: number;
  perPosition: Map<string, PositionQuality>;
}

export function calcPositionQuality(position: Position, nowMs: number): PositionQuality {
  const missingFields: string[] = [];

  if (position.avgPrice <= 0) {
    missingFields.push('cena nabycia');
  }

  const score = missingFields.length === 0 ? 100 : 70;
  const tier: QualityTier = missingFields.length === 0 ? 'complete' : 'incomplete';
  const isStale = nowMs - position.addedAt > STALE_THRESHOLD_MS;

  return { score, tier, isStale, missingFields };
}

export function calcPortfolioQuality(positions: Position[], nowMs: number = Date.now()): PortfolioQuality {
  if (positions.length === 0) {
    return {
      overallScore: 0,
      staleCount: 0,
      completeCount: 0,
      totalCount: 0,
      perPosition: new Map(),
    };
  }

  const perPosition = new Map<string, PositionQuality>();
  let totalScore = 0;
  let staleCount = 0;
  let completeCount = 0;

  for (const pos of positions) {
    const q = calcPositionQuality(pos, nowMs);
    perPosition.set(pos.id, q);
    totalScore += q.score;
    if (q.isStale) staleCount++;
    if (q.tier === 'complete') completeCount++;
  }

  const baseScore = totalScore / positions.length;
  // Freshness penalty: each stale position reduces score by up to 10 points total
  const staleRatio = staleCount / positions.length;
  const overallScore = Math.round(baseScore * (1 - staleRatio * 0.1));

  return {
    overallScore,
    staleCount,
    completeCount,
    totalCount: positions.length,
    perPosition,
  };
}
