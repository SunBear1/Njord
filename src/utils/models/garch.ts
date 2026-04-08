/**
 * GARCH(1,1) with Student-t innovations.
 *
 * Models time-varying volatility (volatility clustering) and fat tails.
 * σ²_{t+1} = ω + α·ε²_t + β·σ²_t
 *
 * Parameters estimated via quasi-MLE with grid search + Nelder-Mead-like refinement.
 * Monte Carlo simulation uses Student-t draws for realistic tail risk.
 */

import type { PredictionResult } from './types';
import { mulberry32, boxMuller, extractPercentiles } from './types';

const N_PATHS = 3000;

interface GarchParams {
  omega: number;   // constant variance term
  alpha: number;   // ARCH coefficient (shock impact)
  beta: number;    // GARCH coefficient (persistence)
  mu: number;      // mean daily return
  nu: number;      // Student-t degrees of freedom (>2)
}

/** Student-t random variate via the Gaussian/chi-squared method */
function studentT(rng: () => number, nu: number): number {
  const [z] = boxMuller(rng);
  // chi-squared approximation: sum of nu squared normals / nu
  let chi2 = 0;
  for (let i = 0; i < Math.round(nu); i++) {
    const [u] = boxMuller(rng);
    chi2 += u * u;
  }
  chi2 /= nu;
  return z / Math.sqrt(chi2 || 1e-10);
}

/** Negative log-likelihood for GARCH(1,1) with Gaussian innovations (quasi-MLE) */
function negLogLikelihood(returns: number[], params: GarchParams): number {
  const { omega, alpha, beta, mu } = params;
  const n = returns.length;
  let sigma2 = returns.reduce((s, r) => s + (r - mu) ** 2, 0) / n; // initial variance
  let nll = 0;

  for (let t = 0; t < n; t++) {
    if (sigma2 < 1e-20) sigma2 = 1e-20;
    const eps = returns[t] - mu;
    nll += 0.5 * (Math.log(sigma2) + (eps * eps) / sigma2);
    sigma2 = omega + alpha * eps * eps + beta * sigma2;
  }

  return nll;
}

/** Estimate kurtosis to set Student-t degrees of freedom */
function estimateNu(returns: number[]): number {
  const n = returns.length;
  const m = returns.reduce((a, b) => a + b, 0) / n;
  const m2 = returns.reduce((a, r) => a + (r - m) ** 2, 0) / n;
  const m4 = returns.reduce((a, r) => a + (r - m) ** 4, 0) / n;
  const kurtosis = m4 / (m2 * m2);
  // kurtosis = 3 + 6/(nu-4) for Student-t → nu = 4 + 6/(kurtosis-3)
  if (kurtosis <= 3.1) return 30; // near-Gaussian
  const nu = 4 + 6 / (kurtosis - 3);
  return Math.max(4.1, Math.min(30, nu)); // clamp to (4.1, 30)
}

/** Grid search + refinement for GARCH parameters */
function fitGarch(returns: number[]): GarchParams | null {
  const n = returns.length;
  if (n < 30) return null;

  const mu = returns.reduce((a, b) => a + b, 0) / n;
  const unconditionalVar = returns.reduce((a, r) => a + (r - mu) ** 2, 0) / n;

  let bestNll = Infinity;
  let best: GarchParams = { omega: unconditionalVar * 0.05, alpha: 0.05, beta: 0.90, mu, nu: 5 };

  // Grid search over (alpha, beta) pairs
  const alphas = [0.02, 0.05, 0.08, 0.12, 0.18];
  const betas = [0.70, 0.80, 0.85, 0.90, 0.94];

  for (const alpha of alphas) {
    for (const beta of betas) {
      if (alpha + beta >= 0.999) continue; // non-stationary
      const omega = unconditionalVar * (1 - alpha - beta);
      if (omega <= 0) continue;
      const params: GarchParams = { omega, alpha, beta, mu, nu: 5 };
      const nll = negLogLikelihood(returns, params);
      if (nll < bestNll) {
        bestNll = nll;
        best = params;
      }
    }
  }

  // Refine: small perturbations around best (simple hill-climbing)
  const deltas = [-0.02, -0.01, 0, 0.01, 0.02];
  for (const da of deltas) {
    for (const db of deltas) {
      const alpha = best.alpha + da;
      const beta = best.beta + db;
      if (alpha < 0.005 || beta < 0.5 || alpha + beta >= 0.999) continue;
      const omega = unconditionalVar * (1 - alpha - beta);
      if (omega <= 0) continue;
      const params: GarchParams = { omega, alpha, beta, mu, nu: best.nu };
      const nll = negLogLikelihood(returns, params);
      if (nll < bestNll) {
        bestNll = nll;
        best = { ...params };
      }
    }
  }

  best.nu = estimateNu(returns);
  return best;
}

/**
 * Run GARCH(1,1) + Student-t Monte Carlo prediction.
 * @param logReturns Daily log-returns
 * @param horizonDays Forward simulation horizon (trading days)
 * @param seed PRNG seed
 */
export function garchPredict(
  logReturns: number[],
  horizonDays: number,
  seed: number,
): PredictionResult {
  const params = fitGarch(logReturns);

  if (!params) {
    return {
      id: 'garch',
      name: 'GARCH',
      description: 'Za mało danych do estymacji GARCH (min. 30 obserwacji).',
      percentiles: [0, 0, 0, 0, 0],
      confidence: 0,
    };
  }

  const { omega, alpha, beta, mu, nu } = params;
  const rng = mulberry32(seed);

  // Current conditional variance from last observation
  const n = logReturns.length;
  let sigma2 = logReturns.reduce((s, r) => s + (r - mu) ** 2, 0) / n;
  for (let t = 0; t < n; t++) {
    const eps = logReturns[t] - mu;
    sigma2 = omega + alpha * eps * eps + beta * sigma2;
  }
  const startSigma2 = sigma2;

  const finalReturns: number[] = [];

  for (let p = 0; p < N_PATHS; p++) {
    let cumLogReturn = 0;
    let sig2 = startSigma2;

    for (let t = 0; t < horizonDays; t++) {
      const sigma = Math.sqrt(sig2);
      const z = studentT(rng, nu);
      const eps = sigma * z;

      // GBM-like: log-return = mu - 0.5*σ² + ε (Itô correction)
      cumLogReturn += mu - 0.5 * sig2 + eps;

      // Update conditional variance
      sig2 = omega + alpha * eps * eps + beta * sig2;
      if (sig2 < 1e-20) sig2 = 1e-20;
    }

    finalReturns.push((Math.exp(cumLogReturn) - 1) * 100);
  }

  finalReturns.sort((a, b) => a - b);

  // Confidence: based on data length and stationarity (alpha+beta < 1)
  const persistence = params.alpha + params.beta;
  const dataFactor = Math.min(1, n / 250);
  const stationarityBonus = persistence < 0.95 ? 0.1 : 0;
  const confidence = Math.min(0.95, 0.4 * dataFactor + 0.3 + stationarityBonus);

  return {
    id: 'garch',
    name: 'GARCH',
    description: `Modeluje zmienną zmienność (α=${params.alpha.toFixed(2)}, β=${params.beta.toFixed(2)}) z grubymi ogonami (ν=${params.nu.toFixed(1)}).`,
    percentiles: extractPercentiles(finalReturns),
    confidence,
  };
}
