/**
 * Shared types for the multi-model prediction framework.
 *
 * Three models (Bootstrap, GARCH, HMM) each produce a PredictionResult.
 * The model selector scores them via out-of-sample backtest and picks the best.
 */

/** Percentile quintuple used by all models */
export type Percentiles = [p5: number, p25: number, p50: number, p75: number, p95: number];

/** Single model's prediction output */
export interface PredictionResult {
  /** Short machine id: 'bootstrap' | 'garch' | 'hmm' */
  id: string;
  /** Human-readable name shown in UI */
  name: string;
  /** One-sentence description (Polish) */
  description: string;
  /** Stock price change percentiles (%) over the horizon */
  percentiles: Percentiles;
  /** Model's self-assessed confidence (0–1). Lower when data is insufficient. */
  confidence: number;
  /** Out-of-sample coverage score (filled by model selector, undefined until scored) */
  coverageScore?: number;
}

/** Result of the model selection backtest */
export interface ModelScoringResult {
  /** All models with their coverageScores filled */
  scored: PredictionResult[];
  /** Index into `scored` of the recommended model */
  recommendedIndex: number;
  /** Coverage of the recommended model (0–1, ideal = 0.90) */
  bestCoverage: number;
}

/** Aggregated output from all models + selection */
export interface ModelResults {
  models: PredictionResult[];
  recommended: PredictionResult;
  scoring: ModelScoringResult | null;
}

// Re-export the seeded PRNG for shared use across models
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller: two standard normals from two uniforms */
export function boxMuller(rng: () => number): [number, number] {
  const u1 = rng();
  const u2 = rng();
  const r = Math.sqrt(-2 * Math.log(u1 || 1e-300));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

/** Extract percentiles from sorted array */
export function extractPercentiles(sorted: number[]): Percentiles {
  const p = (q: number) => sorted[Math.floor(q * sorted.length)] ?? 0;
  return [p(0.05), p(0.25), p(0.5), p(0.75), p(0.95)];
}
