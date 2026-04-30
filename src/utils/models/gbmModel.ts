/**
 * Calibrated GBM (Geometric Brownian Motion) with Student-t quantiles.
 *
 * Produces closed-form scenario percentiles — no Monte Carlo simulation needed.
 * This is the primary prediction model for all horizons ≥ 6 months.
 *
 * Key features:
 * - Drift shrinkage: blends short historical mean toward long-run equity prior
 * - Damped volatility: mean-reversion adjustment for multi-year horizons
 * - Student-t quantiles: fatter tails than Gaussian (ν=5 → z₀.₀₅ ≈ ±2.015)
 * - Hard sanity bounds on all outputs
 *
 * Mathematical basis:
 *   S(T)/S(0) = exp((μ - σ²/2)·T + σ·√T·z)
 *   deltaStock(%) = (S(T)/S(0) - 1) × 100
 *
 * References:
 * - Hull (2018) "Options, Futures, and Other Derivatives" — GBM foundations
 * - Fama & French (1988) — mean reversion evidence for long horizons
 * - Morningstar methodology — drift shrinkage toward long-run priors
 */

import type { PredictionResult, Percentiles } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

/** Student-t quantiles for ν=5 (standard two-sided) */
const STUDENT_T_NU5 = {
  q05: -2.015,
  q25: -0.727,
  q50: 0,
  q75: 0.727,
  q95: 2.015,
};

/** Long-run US equity nominal return prior (Ibbotson / Siegel consensus) */
const EQUITY_RETURN_PRIOR = 0.08;

/** Minimum years of data for full trust in historical drift */
const FULL_TRUST_YEARS = 10;

/** Horizon (years) beyond which mean-reversion damping kicks in */
const DAMP_START_YEARS = 2;

/** Damping rate per year beyond DAMP_START_YEARS */
const DAMP_RATE = 0.015;

/** Minimum damping factor (never reduce σ below this fraction) */
const DAMP_FLOOR = 0.75;

// ── Sanity Bounds ────────────────────────────────────────────────────────────

interface ScenarioBounds {
  /** Maximum annualized return for any scenario (%) */
  maxAnnualReturn: number;
  /** Maximum annualized loss for any scenario (%) */
  maxAnnualLoss: number;
  /** Maximum total return over any horizon (%) */
  maxTotalReturn: number;
  /** Maximum total loss over any horizon (%) */
  maxTotalLoss: number;
}

const BOUNDS: ScenarioBounds = {
  maxAnnualReturn: 100,
  maxAnnualLoss: -80,
  maxTotalReturn: 1000,
  maxTotalLoss: -95,
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Shrink historical drift toward a drift prior (default: long-run equity prior).
 *
 * With only 1 year of data (252 days), w ≈ 0.1 — mostly prior.
 * With 10+ years, w = 1.0 — fully trust historical.
 *
 * @param historicalMeanAnnual Historical annualized mean log-return (decimal)
 * @param dataYears Number of years of historical data
 * @param prior Override the default EQUITY_RETURN_PRIOR (e.g. regime-adjusted prior)
 */
export function shrinkDrift(historicalMeanAnnual: number, dataYears: number, prior: number = EQUITY_RETURN_PRIOR): number {
  const w = Math.min(1, dataYears / FULL_TRUST_YEARS);
  return w * historicalMeanAnnual + (1 - w) * prior;
}

/**
 * Dampen volatility for long horizons (mean-reversion effect).
 *
 * Fama & French (1988): stock return variance grows slower than T for T > 5yr.
 * We use a linear dampening starting at 2 years, floored at 0.75.
 */
export function dampVolatility(sigma: number, horizonYears: number): number {
  if (horizonYears <= DAMP_START_YEARS) return sigma;
  const factor = Math.max(DAMP_FLOOR, 1.0 - DAMP_RATE * (horizonYears - DAMP_START_YEARS));
  return sigma * factor;
}

/**
 * Raw GBM percentile (unclamped).
 *
 * Returns percentage change: (S(T)/S(0) - 1) × 100
 */
function rawGBM(mu: number, sigma: number, T: number, z: number): number {
  return (Math.exp((mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * z) - 1) * 100;
}

/**
 * Clamp a scenario value to sanity bounds.
 */
export function clampScenario(pctChange: number, horizonYears: number): number {
  // Total bounds
  let clamped = Math.max(BOUNDS.maxTotalLoss, Math.min(BOUNDS.maxTotalReturn, pctChange));

  // Annualized bounds (only meaningful for T ≥ 1 month)
  if (horizonYears >= 1 / 12) {
    const ratio = 1 + clamped / 100;
    const annualized = (Math.pow(Math.max(ratio, 0.001), 1 / horizonYears) - 1) * 100;

    if (annualized > BOUNDS.maxAnnualReturn) {
      clamped = (Math.pow(1 + BOUNDS.maxAnnualReturn / 100, horizonYears) - 1) * 100;
    }
    if (annualized < BOUNDS.maxAnnualLoss) {
      clamped = (Math.pow(1 + BOUNDS.maxAnnualLoss / 100, horizonYears) - 1) * 100;
    }
  }

  return clamped;
}

// ── Main Prediction Function ─────────────────────────────────────────────────

/**
 * Produce GBM-based percentile predictions.
 *
 * @param stockSigmaAnnual Historical annualized volatility (as decimal, e.g. 0.30 for 30%)
 * @param stockMeanAnnual Historical annualized mean return (decimal)
 * @param dataYears Number of years of historical data available
 * @param horizonYears Prediction horizon in years
 * @param regimePrior Optional regime-adjusted drift prior (decimal). When provided,
 *                    replaces the default EQUITY_RETURN_PRIOR in drift shrinkage.
 *                    Pass the output of `getRegimeAdjustedPrior()` for regime-aware calibration.
 */
export function gbmPredict(
  stockSigmaAnnual: number,
  stockMeanAnnual: number,
  dataYears: number,
  horizonYears: number,
  regimePrior?: number,
): PredictionResult {
  if (horizonYears <= 0 || stockSigmaAnnual < 0) {
    return {
      id: 'gbm',
      name: 'GBM',
      description: 'Nieprawidłowe parametry wejściowe.',
      percentiles: [0, 0, 0, 0, 0],
      confidence: 0,
    };
  }

  const mu = shrinkDrift(stockMeanAnnual, dataYears, regimePrior ?? EQUITY_RETURN_PRIOR);
  const sigma = dampVolatility(stockSigmaAnnual, horizonYears);

  const rawPercentiles: Percentiles = [
    rawGBM(mu, sigma, horizonYears, STUDENT_T_NU5.q05),
    rawGBM(mu, sigma, horizonYears, STUDENT_T_NU5.q25),
    rawGBM(mu, sigma, horizonYears, STUDENT_T_NU5.q50),
    rawGBM(mu, sigma, horizonYears, STUDENT_T_NU5.q75),
    rawGBM(mu, sigma, horizonYears, STUDENT_T_NU5.q95),
  ];

  const percentiles: Percentiles = rawPercentiles.map(
    p => clampScenario(p, horizonYears),
  ) as Percentiles;

  // Confidence: high for GBM (well-understood model), scales with data availability
  const dataFactor = Math.min(1, dataYears / 2); // full confidence at 2+ years
  const confidence = Math.min(0.95, 0.6 + 0.35 * dataFactor);

  const muPct = (mu * 100).toFixed(1);
  const sigmaPct = (sigma * 100).toFixed(1);
  const wPct = (Math.min(1, dataYears / FULL_TRUST_YEARS) * 100).toFixed(0);

  return {
    id: 'gbm',
    name: 'GBM',
    description: `Model geometrycznego ruchu Browna z rozkładem Studenta (ν=5). μ=${muPct}% (${wPct}% hist.), σ=${sigmaPct}%.`,
    percentiles,
    confidence,
  };
}
