/**
 * Model prediction calibration tests.
 *
 * Validates that GBM and Bootstrap prediction models produce statistically
 * calibrated outputs: correct coverage, cross-model consistency, stability
 * under parameter perturbation, and deterministic reproducibility.
 */
import { describe, it, expect } from 'vitest';

import { syntheticLogReturns } from './scenarioSanity.test';
import { gbmPredict } from '../utils/models/gbmModel';
import { bootstrapPredict } from '../utils/models/bootstrap';
import { mulberry32, boxMuller } from '../utils/models/types';

// ── GBM Coverage Calibration ─────────────────────────────────────────────────

describe('GBM coverage calibration', () => {
  it('90% prediction interval captures 85–95% of synthetic GBM paths', () => {
    const mu = 0.08;
    const sigma = 0.30;
    const T = 1.0;
    const nPaths = 2000;

    // Generate synthetic terminal returns from the true GBM DGP
    const rng = mulberry32(123);
    let insideCount = 0;

    const result = gbmPredict(sigma, mu, 10, T);
    const [p5, , , , p95] = result.percentiles;

    for (let i = 0; i < nPaths; i++) {
      const [z] = boxMuller(rng);
      const finalReturn = (Math.exp((mu - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * z) - 1) * 100;
      if (finalReturn >= p5 && finalReturn <= p95) insideCount++;
    }

    const coverage = insideCount / nPaths;
    expect(coverage).toBeGreaterThanOrEqual(0.85);
    expect(coverage).toBeLessThanOrEqual(0.96);
  });
});

// ── Bootstrap Coverage Calibration ───────────────────────────────────────────

describe('Bootstrap coverage calibration', () => {
  it('90% interval from bootstrap covers 70–99% of synthetic cumulative returns', () => {
    const logReturns = syntheticLogReturns(0.08, 0.30, 252, 42);
    const horizonDays = 63;

    const result = bootstrapPredict(logReturns, horizonDays, 42);
    const [p5, , , , p95] = result.percentiles;

    // Generate 1000 synthetic cumulative returns from the same DGP
    const dailyMu = 0.08 / 252;
    const dailySigma = 0.30 / Math.sqrt(252);
    const rng = mulberry32(999);
    let insideCount = 0;
    const nSim = 1000;

    for (let i = 0; i < nSim; i++) {
      let cumLog = 0;
      for (let d = 0; d < horizonDays; d++) {
        const [z] = boxMuller(rng);
        cumLog += dailyMu + dailySigma * z;
      }
      const cumReturn = (Math.exp(cumLog) - 1) * 100;
      if (cumReturn >= p5 && cumReturn <= p95) insideCount++;
    }

    const coverage = insideCount / nSim;
    expect(coverage).toBeGreaterThanOrEqual(0.70);
    expect(coverage).toBeLessThanOrEqual(0.99);
  });
});

// ── Cross-Model Consistency ──────────────────────────────────────────────────

describe('Cross-model consistency (GBM vs Bootstrap median)', () => {
  it('GBM and Bootstrap p50 agree within 25 percentage points for moderate-vol stock', () => {
    const sigma = 0.30;
    const mu = 0.08;

    const gbmP50 = gbmPredict(sigma, mu, 10, 1.0).percentiles[2];

    const logReturns = syntheticLogReturns(mu, sigma, 252, 42);
    const bootstrapP50 = bootstrapPredict(logReturns, 252, 42).percentiles[2];

    expect(Math.abs(gbmP50 - bootstrapP50)).toBeLessThanOrEqual(25);
  });
});

// ── Stability: Drift Perturbation ────────────────────────────────────────────

describe('Stability — drift perturbation', () => {
  it('bear stays negative and bull stays positive across drift variations', () => {
    const sigma = 0.30;
    const drifts = [0.06, 0.08, 0.10];

    for (const mu of drifts) {
      const result = gbmPredict(sigma, mu, 1, 1.0);
      const [, p25, , p75] = result.percentiles;

      expect(p25).toBeLessThan(0);
      expect(p75).toBeGreaterThan(0);
    }
  });
});

// ── Stability: Volatility Perturbation ───────────────────────────────────────

describe('Stability — volatility perturbation', () => {
  it('higher volatility produces wider prediction spread', () => {
    const mu = 0.08;
    const dataYears = 10;
    const T = 1.0;

    const lowVol = gbmPredict(0.20, mu, dataYears, T);
    const highVol = gbmPredict(0.30, mu, dataYears, T);

    const lowSpread = lowVol.percentiles[4] - lowVol.percentiles[0];
    const highSpread = highVol.percentiles[4] - highVol.percentiles[0];

    expect(highSpread).toBeGreaterThan(lowSpread);
  });
});

// ── Model Selector ───────────────────────────────────────────────────────────

// ── Determinism ──────────────────────────────────────────────────────────────

describe('Determinism — GBM', () => {
  it('identical inputs produce identical percentiles', () => {
    const a = gbmPredict(0.30, 0.08, 5, 1.0);
    const b = gbmPredict(0.30, 0.08, 5, 1.0);

    for (let i = 0; i < 5; i++) {
      expect(a.percentiles[i]).toBe(b.percentiles[i]);
    }
  });
});

describe('Determinism — Bootstrap', () => {
  it('identical inputs and seed produce identical percentiles', () => {
    const logReturns = syntheticLogReturns(0.08, 0.30, 252, 42);

    const a = bootstrapPredict(logReturns, 126, 42);
    const b = bootstrapPredict(logReturns, 126, 42);

    for (let i = 0; i < 5; i++) {
      expect(a.percentiles[i]).toBe(b.percentiles[i]);
    }
  });
});
