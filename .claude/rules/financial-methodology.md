# Financial Methodology — Prediction Models

## Model Selection Logic

| Horizon | Model | Rationale |
|---------|-------|-----------|
| ≤6 months | Block Bootstrap | Short-term: historical patterns dominate, parametric assumptions unreliable |
| >6 months | Calibrated GBM | Long-term: mean-reversion and drift matter, bootstrap loses structure |
| Sell Analysis | HMM + Monte Carlo | Regime-aware: bull/bear states affect optimal sell timing |

NEVER mix models for a single scenario. NEVER use HMM for bear/base/bull generation.

## Block Bootstrap (≤6 months)

### Algorithm
1. Source: 2 years of daily log-returns from historical price data.
2. Block size: 21 trading days (≈1 month) — preserves autocorrelation structure.
3. Sampling: draw random blocks WITH replacement until horizon is filled.
4. Trim: discard excess days beyond target horizon.
5. Scenarios: run 1000 bootstrap samples → extract percentiles (10th, 50th, 90th).

### Parameters
- Block size: FIXED at 21 days. Do not make configurable.
- Number of samples: 1000 (sufficient for percentile stability).
- Percentile mapping: P10 → Bear, P50 → Base, P90 → Bull.

### Constraints
- Minimum input data: 252 trading days (1 year). If less, fall back to GBM.
- Output: delta_stock percentage for each scenario.
- No drift adjustment needed — bootstrap naturally incorporates historical drift.

## Calibrated GBM (>6 months)

### Geometric Brownian Motion
```
S(t) = S(0) × exp((μ − σ²/2) × t + σ × W(t))
```
Where:
- μ = drift (annualized expected return)
- σ = volatility (annualized)
- W(t) = Wiener process (standard Brownian motion)
- t = time in years

### Calibration
1. **Drift estimation:**
   - Raw historical drift from log-returns (2 years).
   - Shrink toward 8% annual prior: `μ_calibrated = 0.6 × μ_historical + 0.4 × 0.08`
   - Rationale: prevents overfitting to recent bull/bear runs.

2. **Volatility estimation:**
   - Annualized standard deviation of daily log-returns.
   - For horizons >2 years: apply damping factor `σ_damped = σ × (1 − 0.1 × min(years − 2, 5))`
   - Rationale: volatility mean-reverts over long horizons.

3. **Scenario generation:**
   - Bear: μ − 1.28σ (≈10th percentile of log-normal)
   - Base: μ (expected value)
   - Bull: μ + 1.28σ (≈90th percentile of log-normal)

### Constraints
- Minimum μ: −30% annual (floor for bear scenarios).
- Maximum μ: +50% annual (cap for extreme bull).
- All outputs pass through `clampScenario()`.

## HMM — Hidden Markov Model (Sell Analysis Only)

### Purpose
Detect market regimes (bull/bear states) and generate regime-conditioned price forecasts for optimal sell timing analysis.

### 2-State Gaussian HMM
States:
- State 0 (Bear): low mean return, high volatility
- State 1 (Bull): high mean return, low volatility

### Parameters (Baum-Welch EM)
- Observations: daily log-returns (2 years).
- Training: Baum-Welch Expectation-Maximization, max 100 iterations, convergence threshold 1e-6.
- Output: transition matrix, emission parameters (μ₀, σ₀, μ₁, σ₁), initial state probabilities.

### Monte Carlo Simulation
1. Determine current regime via Viterbi decoding of recent returns.
2. Simulate 10,000 paths:
   - At each step: sample next state from transition matrix.
   - Sample return from current state's Gaussian emission.
   - Accumulate price path.
3. Extract distribution at each future time step.
4. Report: percentile bands (5th, 25th, 50th, 75th, 95th), probability of hitting target prices.

### Implementation
- Runs in `src/workers/sellAnalysis.worker.ts` (Web Worker).
- NEVER on main thread — 10k paths × N steps would freeze UI.
- Progress updates every 1000 paths via `postMessage`.
- Results: summary statistics only (not raw paths) sent back to main thread.

## Scenario Output Format
All models output the same shape:
```typescript
interface ScenarioSuggestion {
  bear: number;   // delta as decimal (e.g., -0.15 for −15%)
  base: number;   // delta as decimal (e.g., 0.08 for +8%)
  bull: number;   // delta as decimal (e.g., 0.25 for +25%)
}
```

## Clamping Rules (`clampScenario()`)
- Minimum delta: −0.80 (−80% — near-total loss but not negative prices)
- Maximum delta: +3.00 (+300% — 4× growth cap)
- Bear < Base < Bull (enforce ordering — if violated after calibration, swap)
- If bear > 0 and base > 0 and bull > 0: acceptable (prolonged bull market)
- If bear < base > bull: something is wrong — recalibrate

## Inflation Projection (Mean-Reversion)
For inflation-linked bonds with multi-year horizons:
```
projected_inflation(t) = long_term_mean + (current − long_term_mean) × decay^t
```
- Long-term mean: 2.5% (ECB target for Poland/EU)
- Decay factor: 0.7 per year (half-life ≈2 years)
- Floor: 0% (deflation not modeled for bond projections)

## Data Quality Requirements
- Minimum 252 trading days of price history for any model.
- If data has gaps >5 consecutive trading days: warn user, use available data.
- Weekend/holiday prices: use last available trading day (no interpolation).
- Split/dividend adjustments: use adjusted close prices from Yahoo Finance.

## Forbidden Methodology Patterns
- ❌ Using HMM output for bear/base/bull scenario suggestions
- ❌ Block Bootstrap for horizons >6 months (loses long-term structure)
- ❌ GBM without drift shrinkage (overfits to recent history)
- ❌ Reporting raw Monte Carlo paths to UI (memory explosion)
- ❌ Linear interpolation between GBM time steps (use exponential)
- ❌ Assuming constant volatility across regimes in HMM
- ❌ Running Monte Carlo on main thread
- ❌ Using fewer than 1000 bootstrap samples or 10000 MC paths
- ❌ Reporting model outputs without clamping
