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

## Testing

All prediction outputs must satisfy the contract in `src/__tests__/scenarioSanity.test.ts`:

- `validateScenarios()` — checks bounds, monotonicity, sign constraints
- GBM math tests — drift shrinkage, damped vol, Student-t quantiles
- Regression tests — synthetic data with known parameters

Run: `npm test`
