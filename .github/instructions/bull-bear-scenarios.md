---
name: bull-bear-scenarios
description: Detect market regimes (bull/bear), compute expected regime durations, and generate Monte Carlo price scenarios conditioned on detected regimes. Trigger when user asks for: 'regime detection', 'bull/bear scenarios', 'HMM + Monte Carlo', 'stock price scenarios'.
globs:
  - src/hooks/useHistoricalVolatility.ts
  - src/utils/hmm.ts
---
# Bull-Bear Scenario Generator — Agent Instructions

Role: Provide the agent with a procedural workflow for detecting market regimes (bull / bear) using HMM, computing expected regime duration, and generating stock price scenarios via regime-conditioned Monte Carlo (GBM).

## When to Use This Skill
- When the user asks to: "detect bull/bear regime", "generate bull/bear price scenarios", "HMM + Monte Carlo", "stock scenarios for ticker X".

## Steps (Concise Workflow)
1. Fetch historical data (closing prices) at the desired frequency (daily by default). Compute log-returns r_t = ln(P_t / P_{t-1}).
2. Fit an HMM on the return series (e.g. Gaussian HMM with 2-3 states). Use BIC/AIC to choose the number of states if needed.
3. Extract the transition matrix P. For state i, the diagonal element p_ii is the probability of remaining in that state at the next step; the expected duration (in time-step units, e.g. trading days) is approximated by 1 / (1 - p_ii).
4. Choose scenario horizons relative to the expected duration:
   - Short ~ 0.25 x expected_duration
   - Medium ~ 1 x expected_duration
   - Long ~ 2-4 x expected_duration
   Also generate standard comparison horizons (1 day / 1 week / 1 month / quarter / year) for a full analysis.
5. Estimate drift (mu) and volatility (sigma) separately for each state (mean return and std of returns within that state). For conditional volatility modelling, consider GARCH / MS-GARCH for sigma (optional, requires more advanced estimation).
6. Generate N Monte Carlo paths:
   - Simple variant: GBM with parameters (mu_i, sigma_i) depending on the current state and discrete time step dt.
   - Alternative: bootstrap historical residuals or simulate with regime transitions (first simulate the Markov chain, then for each step use the parameters of the active state).
7. Aggregate results: percentiles (5%, 25%, 50%, 75%, 95%), probability of exceeding thresholds, diagnostics of the terminal distribution.
8. Validation: out-of-sample tests and backtesting. Present uncertainty and model limitations (the literature shows that regime-switching models describe history well, but predictive power can be limited).

## Metrics and Quality Controls
- For regimes: per-state return statistics (mean, std, skew), confusion matrix if historical labels are available.
- For scenarios: MSE/MAE for point forecasts; distribution calibration (coverage) for probabilistic intervals.
- Backtest: compare switching-strategy results vs. baseline.

## Practical Rules and Caveats
- Use data of sufficient length (several years for daily data) so the model can observe regime switches; short series increase overfitting risk.
- If p_ii is very high -> long regimes: this means rare transitions; adjust horizons and sampling accordingly.
- Ensure OOS validation -- many studies indicate limited predictive utility of regime models without robust validation.

## Reference Pseudocode (Python sketch)

```python
# pip: hmmlearn, numpy, pandas
import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM

def fit_hmm(returns, n_states=2):
    model = GaussianHMM(n_components=n_states, covariance_type='diag', n_iter=200)
    model.fit(returns.reshape(-1,1))
    states = model.predict(returns.reshape(-1,1))
    P = model.transmat_
    return model, states, P

# expected duration for state i:
# expected_duration = 1 / (1 - P[i,i])

# Monte Carlo GBM conditioned on state params
# S_{t+1} = S_t * exp( (mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*z )
```

## Example Triggers
- "Detect bull or bear regime for ticker X"
- "Generate price scenarios (bull/bear) for 30 days"
- "Fit HMM to returns and run state-conditioned Monte Carlo"

## Implementation in Njord (TypeScript / Browser)
The Njord app implements a 2-state Gaussian HMM directly in TypeScript (`src/utils/hmm.ts`)
using Baum-Welch EM. Key design decisions:
- **2 states only** -- bear (high sigma, low/negative mu) and bull (low sigma, positive mu). With ~250 daily observations, 2 states avoids overfitting.
- **Multiple restarts** -- EM is run from several random initializations; best log-likelihood wins.
- **Seeded PRNG** -- Monte Carlo uses a deterministic seed derived from the data so results are stable across re-renders.
- **Fallback** -- if HMM fitting fails (convergence, degenerate variance), the hook falls back to the original log-normal p5/p95 approach.
- **FX handling** -- HMM is fit on stock returns only; FX deltas remain correlation-adjusted via Pearson rho.

## Reference Files
- `src/utils/hmm.ts` -- Gaussian HMM (Baum-Welch EM) + regime-conditioned Monte Carlo
- `src/hooks/useHistoricalVolatility.ts` -- React hook consuming HMM output

## Further Reading
- HMM for market regime detection -- practical tutorials and implementation examples
- Expected state duration in a Markov chain -- formula and proofs: 1/(1-p_ii)
- Monte Carlo + GBM -- generating stock price paths and practical guides
