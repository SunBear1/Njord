/**
 * Regime-conditional GBM drift prior.
 *
 * When HMM detects a strong bull regime (posterior > 0.7), use a higher drift
 * prior (12% p.a.) to better calibrate near-term scenario generation.
 * When a strong bear regime is detected (posterior < 0.3), use a lower prior (3%).
 * In uncertain / transitional regimes, fall back to the long-run neutral prior (8%).
 *
 * Feature flag: USE_REGIME_PRIOR = true.
 * Set to false to disable regime adjustment and always use the neutral prior.
 */

/** Toggle regime-conditional prior on or off without code revert. */
export const USE_REGIME_PRIOR = true;

const BULL_PRIOR = 0.12; // annualized, strong bull regime
const BEAR_PRIOR = 0.03; // annualized, strong bear regime
const NEUTRAL_PRIOR = 0.08; // long-run US equity nominal return (Ibbotson / Siegel)

const BULL_THRESHOLD = 0.7;
const BEAR_THRESHOLD = 0.3;

/**
 * Return a regime-adjusted drift prior for GBM calibration.
 *
 * @param hmmPosteriorBull Posterior probability of being in bull regime (0–1).
 *                         Pass `null` when HMM was unavailable or did not converge.
 * @param basePrior        Fallback prior if regime info is unavailable or flag is off.
 */
export function getRegimeAdjustedPrior(
  hmmPosteriorBull: number | null,
  basePrior: number = NEUTRAL_PRIOR,
): number {
  if (!USE_REGIME_PRIOR || hmmPosteriorBull === null) return basePrior;

  if (hmmPosteriorBull > BULL_THRESHOLD) return BULL_PRIOR;
  if (hmmPosteriorBull < BEAR_THRESHOLD) return BEAR_PRIOR;
  return NEUTRAL_PRIOR;
}
