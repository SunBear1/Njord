---
description: Financial forecasting principles for stock/FX scenario generation. Use when modifying prediction models, scenario generation, or interpreting forecast outputs.
applyTo: "src/utils/models/**,src/hooks/useHistoricalVolatility.ts,src/__tests__/**"
---
# Financial Forecasting — Agent Instructions

## Core Philosophy

1. **Forecasts ≠ estimates.** All stock/FX predictions are probabilistic ranges, not point predictions. No algorithm is bullet-proof for financial markets.
2. **All models are wrong, but some are useful.** The goal is calibrated uncertainty bounds — not precise price targets.
3. **Simpler is better.** Bloomberg, Morningstar, Wealthfront, and Vanguard all use calibrated GBM (Geometric Brownian Motion) for consumer-facing scenarios. None use HMM or GARCH for this purpose.
4. **Historical returns ≠ expected future returns.** Just because a stock returned +200% last year does not mean +200% is the expected future return. Always shrink toward a market prior.

## Njord Prediction Architecture

### Tiered model selection

| Horizon | Primary Model | Rationale |
|---------|--------------|-----------|
| ≤ 6 months | Block Bootstrap | Empirical, captures recent vol, good with 252 observations |
| > 6 months | Calibrated GBM | Mathematically sound, handles long horizons natively |

### GBM implementation (`src/utils/models/gbmModel.ts`)

Closed-form — no Monte Carlo needed:

```
deltaStock = exp((μ - σ²/2)·T + σ·√T·z) - 1
```

- **Student-t quantiles** (ν = 5): fatter tails than Gaussian — z_bear = -2.015, z_bull = +2.015
- **Bear/Bull**: p25/p75 quantiles (not p5/p95, which are too extreme for consumer scenarios)
- **Base**: p50 (median expected return)

### Drift shrinkage

```
μ = w × μ_historical + (1 - w) × μ_prior
w = min(1, dataYears / 10)
μ_prior = 8% (long-run US equity nominal return)
```

With 1 year of data: w = 0.1, so 90% prior + 10% historical. This prevents absurd extrapolation of recent performance.

### Damped volatility (horizons > 2 years)

```
σ_eff = σ × max(0.75, 1 - 0.015 × (T_years - 2))
```

Based on Fama & French (1988) evidence of weak mean-reversion in stock returns. At 12 years: dampFactor ≈ 0.85.

### Sanity bounds (`clampScenario`)

Every scenario output is hard-clamped:

| Constraint | Limit |
|-----------|-------|
| Annual return | [-80%, +100%] |
| Total return | [-95%, +1000%] |
| Bear scenario | Always < 0 |
| Bull scenario | Always > 0 |

## Anti-patterns — DO NOT

- ❌ **Use raw historical mean return as the expected future return.** Always apply drift shrinkage.
- ❌ **Fit HMM/regime-switching on < 2000 observations.** With 252 daily points, Baum-Welch cannot reliably distinguish regimes from noise.
- ❌ **Use GARCH forecasts for horizons > 20 days.** GARCH vol mean-reverts to unconditional σ within ~20 trading days — adds no value beyond that.
- ❌ **Use √T scaling on bootstrap percentiles.** This amplifies already-extreme percentiles exponentially for long horizons. GBM handles all horizons natively.
- ❌ **Output scenarios without sanity bounds.** Every prediction must pass through `clampScenario()`.
- ❌ **Present forecasts as certainties.** UI must always frame outputs as scenarios, not predictions. Use language like "w scenariuszu niedźwiedzia" (in the bear scenario), never "spadnie o" (will fall by).

## What reasonable scenarios look like

| Stock type | Horizon | Bear | Base | Bull |
|-----------|---------|------|------|------|
| Low-vol (SPY, σ≈15%) | 12 mo | -16% | +6% | +28% |
| High-vol (NVDA, σ≈50%) | 12 mo | -38% | +5% | +58% |
| Any | 10 yr | Wider, but bounded by [-95%, +1000%] |

If a scenario falls far outside these ranges, something is wrong with the calibration.

## HMM — informational only

The HMM module (`src/utils/models/hmmModel.ts`) is kept for regime detection display (interesting context for the user), but:

- Its confidence is capped at 0.25 (cannot be the recommended model)
- It is tagged as `[Informacyjny]` in the UI
- It must **never** drive scenario numbers for investment decisions

### HMM Parameters (Baum-Welch EM)
- States: State 0 (Bear — low mean return, high volatility), State 1 (Bull — high mean return, low volatility).
- Observations: daily log-returns (2 years).
- Training: Baum-Welch EM, max 100 iterations, convergence threshold 1e-6.
- Output: transition matrix, emission parameters (μ₀, σ₀, μ₁, σ₁), initial state probabilities.

### Monte Carlo Simulation (Sell Analysis)
1. Determine current regime via Viterbi decoding of recent returns.
2. Simulate 10,000 paths — sample next state from transition matrix, sample return from state's Gaussian emission.
3. Extract percentile bands (5th, 25th, 50th, 75th, 95th) at each future time step.
4. Runs in `src/workers/sellAnalysis.worker.ts` — NEVER on main thread.
5. Progress updates every 1000 paths via `postMessage`. Send only summary statistics, not raw paths.

---

## Block Bootstrap — Algorithm Details

1. Source: 2 years of daily log-returns from historical price data.
2. Block size: FIXED at 21 trading days (≈1 month) — preserves autocorrelation structure. Do not make configurable.
3. Sampling: draw random blocks WITH replacement until horizon is filled. Discard excess days.
4. Samples: 1000 (sufficient for percentile stability). P10 → Bear, P50 → Base, P90 → Bull.
5. Minimum input data: 252 trading days. If less, fall back to GBM.

---

## Inflation Projection (Mean-Reversion)

For inflation-linked bonds with multi-year horizons:
```
projected_inflation(t) = long_term_mean + (current − long_term_mean) × decay^t
```
- Long-term mean: 2.5% (ECB target)
- Decay factor: 0.7 per year (half-life ≈2 years)
- Floor: 0% (deflation not modeled for bond projections)

---

## Data Quality Requirements

- Minimum 252 trading days of price history for any model.
- If data has gaps >5 consecutive trading days: warn user, use available data.
- Weekend/holiday prices: use last available trading day (no interpolation).
- Split/dividend adjustments: use adjusted close prices from Yahoo Finance.

---

## Testing

All prediction outputs must satisfy the contract in `src/__tests__/scenarioSanity.test.ts`:

- `validateScenarios()` — checks bounds, monotonicity, sign constraints
- GBM math tests — drift shrinkage, damped vol, Student-t quantiles
- Regression tests — synthetic data with known parameters

Run: `npm test`
