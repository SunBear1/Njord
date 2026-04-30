/**
 * Gaussian Hidden Markov Model (2-state) with Baum-Welch EM
 * and regime-conditioned Monte Carlo scenario generation.
 *
 * Used by: Sell Analysis feature (useSellAnalysis → sellAnalysis.ts)
 * NOT used by: Scenario prediction pipeline (bear/base/bull uses GBM + Bootstrap only)
 *
 * The prediction pipeline labels HMM as "informational only" because it does NOT
 * drive scenario numbers. However, this module IS actively used for the Sell Analysis
 * Monte Carlo simulation and regime detection display.
 */

import { mulberry32, boxMuller } from './models/types';
import { TRADING_DAYS_PER_YEAR } from './assetConfig';

// Re-export for consumers that import from hmm.ts
export { mulberry32, boxMuller };

// ---------------------------------------------------------------------------
// HMM Types
// ---------------------------------------------------------------------------

export interface HmmModel {
  nStates: number;
  /** Initial state probabilities [nStates] */
  pi: number[];
  /** Transition matrix [nStates x nStates] — transmat[i][j] = P(state j | state i) */
  transmat: number[][];
  /** Per-state emission means */
  means: number[];
  /** Per-state emission standard deviations */
  stds: number[];
  /** Log-likelihood of the fitted model */
  logLikelihood: number;
}

export interface RegimeInfo {
  /** Index of the current (last observation) most-likely state */
  currentState: number;
  /** 'bear' or 'bull' label for the current state */
  currentRegimeLabel: 'bear' | 'bull';
  /** Posterior probability of the current state (0–1), e.g. 0.78 = "78% confidence" */
  posteriorProbability: number;
  /** Expected duration of each state in trading days */
  expectedDurations: number[];
  /** Per-state annualized mean return (%) */
  stateMeansAnnual: number[];
  /** Per-state annualized volatility (%) */
  stateSigmasAnnual: number[];
  /** Transition matrix */
  transmat: number[][];
}

// ---------------------------------------------------------------------------
// Gaussian PDF (log-space for numerical stability)
// ---------------------------------------------------------------------------

function logGaussianPdf(x: number, mean: number, std: number): number {
  const z = (x - mean) / std;
  return -0.5 * Math.log(2 * Math.PI) - Math.log(std) - 0.5 * z * z;
}

// ---------------------------------------------------------------------------
// Forward algorithm (log-space with scaling)
// ---------------------------------------------------------------------------

function forward(
  obs: number[],
  pi: number[],
  transmat: number[][],
  means: number[],
  stds: number[],
): { alpha: number[][]; logLikelihood: number } {
  const T = obs.length;
  const K = pi.length;
  const alpha: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
  let logLik = 0;

  // t = 0
  let scale = 0;
  for (let j = 0; j < K; j++) {
    alpha[0][j] = pi[j] * Math.exp(logGaussianPdf(obs[0], means[j], stds[j]));
    scale += alpha[0][j];
  }
  if (scale > 0) {
    for (let j = 0; j < K; j++) alpha[0][j] /= scale;
    logLik += Math.log(scale);
  }

  // t = 1..T-1
  for (let t = 1; t < T; t++) {
    scale = 0;
    for (let j = 0; j < K; j++) {
      let sum = 0;
      for (let i = 0; i < K; i++) sum += alpha[t - 1][i] * transmat[i][j];
      alpha[t][j] = sum * Math.exp(logGaussianPdf(obs[t], means[j], stds[j]));
      scale += alpha[t][j];
    }
    if (scale > 0) {
      for (let j = 0; j < K; j++) alpha[t][j] /= scale;
      logLik += Math.log(scale);
    }
  }

  return { alpha, logLikelihood: logLik };
}

// ---------------------------------------------------------------------------
// Backward algorithm (scaled)
// ---------------------------------------------------------------------------

function backward(
  obs: number[],
  transmat: number[][],
  means: number[],
  stds: number[],
): number[][] {
  const T = obs.length;
  const K = transmat.length;
  const beta: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));

  // t = T-1
  for (let j = 0; j < K; j++) beta[T - 1][j] = 1;

  // t = T-2..0
  for (let t = T - 2; t >= 0; t--) {
    let scale = 0;
    for (let i = 0; i < K; i++) {
      let sum = 0;
      for (let j = 0; j < K; j++) {
        sum += transmat[i][j] * Math.exp(logGaussianPdf(obs[t + 1], means[j], stds[j])) * beta[t + 1][j];
      }
      beta[t][i] = sum;
      scale += sum;
    }
    if (scale > 0) {
      for (let i = 0; i < K; i++) beta[t][i] /= scale;
    }
  }

  return beta;
}

// ---------------------------------------------------------------------------
// Baum-Welch EM — single run
// ---------------------------------------------------------------------------

function baumWelchSingle(
  obs: number[],
  nStates: number,
  maxIter: number,
  rng: () => number,
): HmmModel | null {
  const T = obs.length;
  const K = nStates;

  // Random initialization
  let pi = Array.from({ length: K }, () => rng());
  const piSum = pi.reduce((a, b) => a + b, 0);
  pi = pi.map((p) => p / piSum);

  let transmat = Array.from({ length: K }, () => {
    const row = Array.from({ length: K }, () => rng());
    const s = row.reduce((a, b) => a + b, 0);
    return row.map((v) => v / s);
  });

  // K-means-ish init: split data into K quantile groups
  const sorted = [...obs].sort((a, b) => a - b);
  const groupSize = Math.floor(T / K);
  let means = Array.from({ length: K }, (_, i) => {
    const start = i * groupSize;
    const end = i === K - 1 ? T : (i + 1) * groupSize;
    const slice = sorted.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  const globalStd = Math.sqrt(obs.reduce((a, b) => a + b * b, 0) / T - (obs.reduce((a, b) => a + b, 0) / T) ** 2);
  let stds = Array.from({ length: K }, () => globalStd * (0.5 + rng()));

  let prevLogLik = -Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    // E-step
    const { alpha, logLikelihood } = forward(obs, pi, transmat, means, stds);
    const beta = backward(obs, transmat, means, stds);

    // Convergence check
    if (Math.abs(logLikelihood - prevLogLik) < 1e-6 && iter > 2) {
      return { nStates: K, pi, transmat, means, stds, logLikelihood };
    }
    prevLogLik = logLikelihood;

    // Compute gamma and xi
    const gamma: number[][] = Array.from({ length: T }, () => new Array(K).fill(0));
    const xi: number[][][] = Array.from({ length: T - 1 }, () =>
      Array.from({ length: K }, () => new Array(K).fill(0)),
    );

    for (let t = 0; t < T; t++) {
      let sum = 0;
      for (let i = 0; i < K; i++) {
        gamma[t][i] = alpha[t][i] * beta[t][i];
        sum += gamma[t][i];
      }
      if (sum > 0) {
        for (let i = 0; i < K; i++) gamma[t][i] /= sum;
      }
    }

    for (let t = 0; t < T - 1; t++) {
      let sum = 0;
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          xi[t][i][j] =
            alpha[t][i] *
            transmat[i][j] *
            Math.exp(logGaussianPdf(obs[t + 1], means[j], stds[j])) *
            beta[t + 1][j];
          sum += xi[t][i][j];
        }
      }
      if (sum > 0) {
        for (let i = 0; i < K; i++) {
          for (let j = 0; j < K; j++) xi[t][i][j] /= sum;
        }
      }
    }

    // M-step
    pi = gamma[0].slice();

    transmat = Array.from({ length: K }, (_, i) => {
      const row = new Array(K).fill(0);
      let denom = 0;
      for (let t = 0; t < T - 1; t++) denom += gamma[t][i];
      if (denom > 0) {
        for (let j = 0; j < K; j++) {
          let num = 0;
          for (let t = 0; t < T - 1; t++) num += xi[t][i][j];
          row[j] = num / denom;
        }
      } else {
        // Uniform fallback
        for (let j = 0; j < K; j++) row[j] = 1 / K;
      }
      return row;
    });

    means = Array.from({ length: K }, (_, i) => {
      let num = 0, denom = 0;
      for (let t = 0; t < T; t++) {
        num += gamma[t][i] * obs[t];
        denom += gamma[t][i];
      }
      return denom > 0 ? num / denom : means[i];
    });

    stds = Array.from({ length: K }, (_, i) => {
      let num = 0, denom = 0;
      for (let t = 0; t < T; t++) {
        num += gamma[t][i] * (obs[t] - means[i]) ** 2;
        denom += gamma[t][i];
      }
      const variance = denom > 0 ? num / denom : stds[i] ** 2;
      return Math.sqrt(Math.max(variance, 1e-10));
    });
  }

  return { nStates: K, pi, transmat, means, stds, logLikelihood: prevLogLik };
}

// ---------------------------------------------------------------------------
// Public: Fit HMM with multiple restarts
// ---------------------------------------------------------------------------

const N_RESTARTS = 12;
const MAX_ITER = 100;
const MIN_STD = 1e-8;

export function fitGaussianHmm(
  obs: number[],
  nStates: number = 2,
  seed: number = 42,
): HmmModel | null {
  if (obs.length < 20) return null;

  const rng = mulberry32(seed);
  let bestModel: HmmModel | null = null;

  for (let r = 0; r < N_RESTARTS; r++) {
    const model = baumWelchSingle(obs, nStates, MAX_ITER, rng);
    if (!model) continue;

    // Sanity: reject degenerate models
    if (model.stds.some((s) => s < MIN_STD)) continue;
    if (!isFinite(model.logLikelihood)) continue;
    if (model.means.some((m) => !isFinite(m)) || model.stds.some((s) => !isFinite(s))) continue;

    if (!bestModel || model.logLikelihood > bestModel.logLikelihood) {
      bestModel = model;
    }
  }

  if (!bestModel) return null;

  // Sort states so that state 0 = lower mean (bear), state 1 = higher mean (bull)
  if (bestModel.nStates === 2 && bestModel.means[0] > bestModel.means[1]) {
    bestModel.means.reverse();
    bestModel.stds.reverse();
    bestModel.pi.reverse();
    bestModel.transmat = [
      [bestModel.transmat[1][1], bestModel.transmat[1][0]],
      [bestModel.transmat[0][1], bestModel.transmat[0][0]],
    ];
  }

  return bestModel;
}

// ---------------------------------------------------------------------------
// Public: Detect current regime
// ---------------------------------------------------------------------------

export function detectCurrentRegime(obs: number[], model: HmmModel): RegimeInfo {
  const { alpha } = forward(obs, model.pi, model.transmat, model.means, model.stds);
  const lastAlpha = alpha[obs.length - 1];

  // Normalize to get posterior P(state | all observations)
  const sum = lastAlpha.reduce((a, b) => a + b, 0);
  const posterior = lastAlpha.map((a) => (sum > 0 ? a / sum : 1 / model.nStates));
  const currentState = posterior.indexOf(Math.max(...posterior));

  const expectedDurations = model.transmat.map((row, i) => 1 / (1 - row[i] + 1e-10));

  // Correct annualization via exp() for log-returns (not simple multiplication)
  const stateMeansAnnual = model.means.map((m) => (Math.exp(m * TRADING_DAYS_PER_YEAR) - 1) * 100);
  const stateSigmasAnnual = model.stds.map((s) => s * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100);

  return {
    currentState,
    currentRegimeLabel: currentState === 0 ? 'bear' : 'bull',
    posteriorProbability: posterior[currentState],
    expectedDurations,
    stateMeansAnnual,
    stateSigmasAnnual,
    transmat: model.transmat,
  };
}

// ---------------------------------------------------------------------------
// Public: Regime-conditioned Monte Carlo
// ---------------------------------------------------------------------------

interface MonteCarloResult {
  /** Percentile price changes (%) at [p5, p25, p50, p75, p95] */
  percentiles: [number, number, number, number, number];
}

export function regimeConditionedMonteCarlo(
  model: HmmModel,
  currentState: number,
  horizonDays: number,
  nPaths: number = 3000,
  seed: number = 123,
): MonteCarloResult {
  const rng = mulberry32(seed);
  const dt = 1; // 1 trading day
  const finalReturns: number[] = [];

  for (let p = 0; p < nPaths; p++) {
    let state = currentState;
    let logReturn = 0;

    for (let t = 0; t < horizonDays; t++) {
      const mu = model.means[state];
      const sigma = model.stds[state];

      // GBM step: mu is already the mean of observed log-returns (≈ drift − ½σ²),
      // so no additional Itô correction is needed.
      const [z] = boxMuller(rng);
      logReturn += mu * dt + sigma * Math.sqrt(dt) * z;

      // Regime transition
      const u = rng();
      const pStay = model.transmat[state][state];
      if (u > pStay) {
        // Transition to another state (for 2-state, it's the other one)
        state = state === 0 ? 1 : 0;
      }
    }

    finalReturns.push((Math.exp(logReturn) - 1) * 100); // percentage change
  }

  // Sort and extract percentiles
  finalReturns.sort((a, b) => a - b);
  const pctile = (p: number) => finalReturns[Math.floor(p * finalReturns.length)] ?? 0;

  return {
    percentiles: [pctile(0.05), pctile(0.25), pctile(0.5), pctile(0.75), pctile(0.95)],
  };
}
