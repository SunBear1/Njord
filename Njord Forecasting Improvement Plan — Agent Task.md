
# Njord Forecasting Improvement Plan — Agent Task

## Overview

This document defines a structured implementation plan for an AI agent (Claude Sonnet) to improve the forecasting methodology in the [Njord repository](https://github.com/SunBear1/Njord). The plan is broken into discrete, testable tasks with explicit validation criteria for each step.

**Repository:** `https://github.com/SunBear1/Njord`
**Primary language:** TypeScript
**Test framework:** Vitest
**CI/CD:** GitHub Actions (daily cron backtest)

---

## Task 1: Feed HMM Regime into GBM Drift Prior

**Priority:** Highest — directly addresses the backtest calibration asymmetry (bias ratio 2.47–4.55 during bull regimes)

### Problem

The HMM model detects market regimes (bull/bear with posterior probabilities), but the GBM model — which produces the bear/base/bull scenarios users see — completely ignores this information. It always shrinks drift toward an 8% prior regardless of detected regime.

### Implementation Steps

1. **Read the current GBM drift logic** in `src/utils/models/gbmModel.ts`. Locate the drift shrinkage formula:
   ```
   w = min(1, dataYears / FULL_TRUST_YEARS)
   shrunk_drift = w * observed_drift + (1 - w) * PRIOR_DRIFT
   ```
   where `PRIOR_DRIFT = 0.08` and `FULL_TRUST_YEARS = 10`.

2. **Read the HMM output** in `src/utils/models/hmm.ts` and `src/utils/models/hmmModel.ts`. Identify the exported regime state — specifically the posterior probability of being in bull vs bear state.

3. **Create a regime-conditional prior function** in a new file `src/utils/models/regimePrior.ts`:
   ```typescript
   export function getRegimeAdjustedPrior(
     hmmPosteriorBull: number,  // 0.0 to 1.0
     basePrior: number = 0.08
   ): number {
     const BULL_PRIOR = 0.12;
     const BEAR_PRIOR = 0.03;
     const NEUTRAL_PRIOR = 0.08;

     if (hmmPosteriorBull > 0.7) return BULL_PRIOR;
     if (hmmPosteriorBull < 0.3) return BEAR_PRIOR;
     return NEUTRAL_PRIOR;
   }
   ```

4. **Modify `gbmModel.ts`** to accept an optional `regimePrior` parameter. If provided, use it instead of the hardcoded 0.08. If not provided (e.g., HMM fails to converge), fall back to 0.08.

5. **Wire the HMM output into the GBM call** at the orchestration level (wherever the model selection logic lives — likely in the component that calls both models). Run HMM first, extract posterior, pass regime-adjusted prior to GBM.

6. **Gate behind a feature flag** — add a constant `USE_REGIME_PRIOR = true` that can be toggled off without reverting code.

### Validation

- Run `npm run test:backtest` before and after the change
- **Pass criterion:** Coverage should increase (closer to 50%) OR bias ratio should decrease (closer to 1.0) on the same test window
- **Fail criterion:** If coverage drops below 34% (current FAIL gate) or bias ratio increases, revert
- Unit test: given a mock HMM posterior of 0.9 (strong bull), the prior should be 0.12, not 0.08
- Unit test: given a mock HMM posterior of 0.5 (uncertain), the prior should remain 0.08

---

## Task 2: Add Downside Touch Probabilities

**Priority:** Medium — better UX for sell decisions, no model risk

### Problem

The `generateTargets()` function in sell analysis generates targets from -10% to +40% in 5% steps. This is heavily skewed toward upside targets (8 positive vs 2 negative), giving users no visibility into drawdown risk.

### Implementation Steps

1. **Locate `generateTargets()`** in the sell analysis module (likely `src/utils/sellAnalysis.ts` or related).

2. **Extend the target range** to include downside:
   ```typescript
   // Before: -10% to +40% in 5% steps
   // After:  -25% to +40% in 5% steps
   ```
   This adds targets at -25%, -20%, -15% (3 new downside levels).

3. **Compute `P(price ≤ target)` for downside targets** — this is the probability that the price touches or drops below the target at any point during the horizon. The Monte Carlo path simulation should already support this (checking `min(path) <= target` instead of `max(path) >= target`).

4. **Label downside probabilities clearly in the output** — e.g., "Drawdown Risk" vs "Upside Touch" so the UI can distinguish them.

5. **Update any UI components** that render touch probabilities to display downside targets with appropriate styling (e.g., red for drawdown risk).

### Validation

- Unit test: for a strongly negative-drift stock, `P(price ≤ -20%)` should be > `P(price ≤ -25%)`
- Unit test: `P(price ≤ 0%)` should always be > 0 for any non-zero volatility
- Integration test: run sell analysis on a known ticker and verify downside probabilities appear in output
- **No backtest regression** — this change doesn't affect the GBM model, so coverage metrics should remain unchanged

---

## Task 3: Time-Weighted Expected Sell Price

**Priority:** Medium — more accurate sell recommendations

### Problem

The current expected value formula:
```
expectedValue = pTouch * target + (1 - pTouch) * medianFinalPrice
```
...treats all touches equally regardless of *when* they occur. Selling on day 10 is more valuable than selling on day 200 (time value of money, reinvestment opportunity).

### Implementation Steps

1. **Locate the expected value calculation** in the sell analysis module.

2. **Track touch timing in Monte Carlo paths** — for each path that touches the target, record *which day* it first touches:
   ```typescript
   let touchDays: number[] = [];
   for (const path of paths) {
     for (let day = 0; day < path.length; day++) {
       if (path[day] >= target) {
         touchDays.push(day);
         break;
       }
     }
   }
   const meanTouchDay = touchDays.reduce((a, b) => a + b, 0) / touchDays.length;
   ```

3. **Update the expected value formula:**
   ```typescript
   const rf = 0.04; // risk-free rate (or fetch from config)
   const remainingDays = horizonDays - meanTouchDay;
   const reinvestmentGain = 1 + rf * (remainingDays / 252);
   
   expectedValue = pTouch * target * reinvestmentGain 
                 + (1 - pTouch) * medianFinalPrice;
   ```

4. **Expose `meanTouchDay` and `medianTouchDay` in the output** — this is useful information for users ("expected to reach target in ~45 days").

### Validation

- Unit test: given two targets with same `pTouch` but different `meanTouchDay`, the earlier-touch target should have higher `expectedValue`
- Unit test: with `rf = 0`, the formula should collapse to the original (no change)
- Sanity check: `meanTouchDay` should always be ≤ `horizonDays`
- **No backtest regression** — this doesn't affect GBM calibration

---

## Task 4: Increase HMM Restarts

**Priority:** Low-Medium — improves regime detection reliability

### Problem

`N_RESTARTS = 5` for Baum-Welch initialization. With only 5 random restarts on financial data (which has ambiguous regime boundaries), the model may find local optima.

### Implementation Steps

1. **Locate `N_RESTARTS`** in `src/utils/models/hmm.ts`.

2. **Change from 5 to 12:**
   ```typescript
   const N_RESTARTS = 12;
   ```

3. **Verify runtime impact** — with ~250-500 observations and a 2-state model, each restart takes <50ms. Going from 5→12 adds ~350ms total. Acceptable for a non-interactive batch process.

4. **Optional: add convergence logging** — log the log-likelihood of each restart's result to verify that multiple restarts are actually finding different optima (if they all converge to the same value, 5 was already sufficient).

### Validation

- Run HMM on 5 different tickers, compare detected regime with N_RESTARTS=5 vs N_RESTARTS=12
- If results are identical for all 5, the change is harmless but unnecessary (still keep it — it's defensive)
- If results differ for any ticker, verify the higher-restart result has better log-likelihood
- **Performance gate:** total HMM fit time should remain under 2 seconds per ticker

---

## Task 5: Variable Bootstrap Block Size

**Priority:** Low — marginal improvement for short-horizon predictions

### Problem

Block size is fixed at 5 days. This captures weekly autocorrelation but can't capture monthly momentum effects (20-60 day scale).

### Implementation Steps

1. **Locate the block size constant** in `src/utils/models/bootstrap.ts`.

2. **Replace with adaptive formula:**
   ```typescript
   const BLOCK_SIZE = Math.min(20, Math.max(5, Math.floor(horizonDays / 20)));
   ```

3. **Ensure the resampling logic handles variable block sizes** — verify that the total number of blocks * block size covers the horizon without off-by-one errors.

### Validation

- Unit test: `horizonDays=21` → block size 5
- Unit test: `horizonDays=126` → block size 6
- Unit test: `horizonDays=252` → block size 12
- Compare bootstrap output distributions (mean, p25, p75) for a sample ticker before/after — they should be similar (not wildly different), confirming the change is a refinement, not a disruption
- **No backtest regression**

---

## Task 6: Fix Itô Correction in Regime-Switching Monte Carlo

**Priority:** Low — addresses ~1-3% optimistic bias in touch probabilities

### Problem

When the HMM Monte Carlo transitions from bear → bull mid-path, the compound return gets a small upward bias due to Jensen's inequality (`Math.exp()` is convex). The comment says "no extra Itô correction needed" but this is only approximately correct for single-regime paths.

### Implementation Steps

1. **Locate the path simulation** in `hmm.ts` or `sellAnalysis.ts` where regime-switching Monte Carlo is implemented.

2. **Add per-step Itô correction:**
   ```typescript
   // Before:
   // logReturn = mu_regime * dt + sigma_regime * sqrt(dt) * z
   
   // After:
   const logReturn = (mu_regime - 0.5 * sigma_regime ** 2) * dt 
                   + sigma_regime * Math.sqrt(dt) * z;
   ```

3. **Only apply if the code currently uses raw `mu` without the `-0.5 * sigma^2` term.** If it already includes this correction (check carefully), this task is a no-op.

### Validation

- Generate 100K paths with and without correction, compare median terminal price to `S₀ * exp(mu * T)` — the corrected version should match more closely
- Touch probabilities should decrease slightly (1-3%) for upside targets after correction
- **No backtest regression** (this affects sell analysis only, not GBM calibration)

---

## Validation Loop (Meta-Process)

This section defines how the agent should validate its work across all tasks.

### Before Starting Any Task

1. **Clone the repository and run the full test suite:**
   ```bash
   git clone https://github.com/SunBear1/Njord.git
   cd Njord
   npm install
   npm run test
   npm run test:backtest
   ```
2. **Record baseline metrics:** coverage_pct, bias_ratio, above_bull_pct, below_bear_pct, base_mae_pp
3. **Save baseline test output** for comparison

### After Each Task

1. **Run the full test suite** — all existing tests must still pass
2. **Run the backtest** — compare metrics to baseline
3. **Apply the acceptance criteria** specific to that task (listed above)
4. **If any criterion fails:**
   - Do NOT proceed to the next task
   - Revert the change
   - Log what went wrong and why
   - Attempt a modified approach (max 2 retries per task)
   - If still failing after retries, skip the task and move on

### After All Tasks Complete

1. **Run final backtest** and compare to original baseline
2. **Expected outcomes:**
   - Coverage closer to 50% (target: 42-52%)
   - Bias ratio closer to 1.0 (target: < 2.5)
   - All existing unit tests still green
   - No new runtime errors or crashes
3. **Generate a summary diff** showing before/after metrics for each changed file
4. **Create a single PR** with all changes, clearly labeling which task each commit corresponds to

### Rollback Strategy

If the final combined result is *worse* than baseline:
- Identify which task caused the regression (bisect by reverting tasks one at a time)
- Keep only tasks that improve or are neutral
- Document why the rejected task failed

---

## Execution Order

The tasks should be executed in this specific order due to dependencies:

```
Task 4 (HMM restarts)     — improves HMM quality
    ↓
Task 1 (regime → GBM)     — depends on good HMM output
    ↓
Task 6 (Itô correction)   — independent, but affects MC paths used by...
    ↓
Task 2 (downside touch)   — uses MC paths
    ↓
Task 3 (time-weighted EV) — uses touch data from Task 2
    ↓
Task 5 (bootstrap blocks) — fully independent, do last
```

Each task produces a separate commit. Validate after each. The pipeline is:

```
implement → test → backtest → compare to baseline → pass/fail → next task or retry
```

---

## Notes for the Agent

- **Do not modify test thresholds** to make tests pass. If a test fails, the code is wrong, not the test.
- **Do not change the FAIL gate** (currently 34% coverage). That's a product decision, not yours.
- **Preserve the feature flag pattern** — all behavioral changes should be toggleable via a constant so they can be disabled without code revert.
- **Read existing comments carefully** — the codebase has explanatory comments about design intent. Respect them unless this plan explicitly contradicts them.
- **The backtest is deterministic** (same date seed = same tickers). This means you can reliably compare before/after without worrying about randomness in ticker selection.
- **Performance budget:** The full backtest should complete within the GitHub Actions timeout (currently ~10 minutes). If your changes add significant compute, optimize or reduce N_PATHS.