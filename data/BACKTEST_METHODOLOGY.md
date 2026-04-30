# Backtest Methodology — Njord Prediction Engine

## Purpose

The daily backtest validates Njord's **calibrated GBM (Geometric Brownian Motion)** prediction
engine against real market outcomes. It answers: "Are the bear/base/bull scenarios the app shows
to users statistically well-calibrated?"

This is a **walk-forward validation** — the gold standard for financial model testing — meaning
the model never sees future data during calibration.

## How It Works

1. **Universe**: ~250 liquid US stocks/ETFs across 16 sectors (mega-tech, biotech, energy, etc.)
2. **Daily sample**: 100 tickers randomly selected (seeded by date for reproducibility)
3. **Data**: 5 years of daily adjusted close prices from Yahoo Finance
4. **Walk-forward split**:
   - **Calibration window**: First 504 trading days (~2 years) → compute σ (volatility) and μ (drift)
   - **Test window**: Next 252 trading days (~1 year) → actual realized return
5. **Prediction**: Run production `gbmPredict()` on calibration data → get p25/p50/p75 percentiles
6. **Evaluation**: Compare predicted [bear, base, bull] range against actual 12-month return

## Why This Is Useful for Njord

- **Tests production code directly** — imports `gbmPredict` from the same module the app uses
- **Detects calibration drift** — if model changes degrade prediction quality, the daily run catches it
- **Validates drift shrinkage** — the 8% equity prior blending is tested against real outcomes
- **Sector diversity** — ensures the model works across different volatility regimes (not just tech)
- **Regime awareness** — labels runs as bull/bear/neutral (SPY-based) so results can be interpreted in context

## Acceptance Gates

| Gate | Criterion | Rationale |
|------|-----------|-----------|
| G1 | Coverage rate ∈ [35%, 65%] | p25/p75 should capture ~50% of outcomes if well-calibrated |
| G2 | Bear sign accuracy ≥ 90% | Bear scenario must be negative (basic sanity) |
| G3 | Stocks processed ≥ 50 | Statistical significance threshold |

## Metrics Tracked (data/backtest-history.csv)

| Column | Meaning |
|--------|---------|
| `coverage_pct` | % of stocks where actual return fell within [bear, bull] |
| `above_bull_pct` | % of stocks that outperformed the bull scenario |
| `below_bear_pct` | % of stocks that underperformed the bear scenario |
| `bias_ratio` | above_bull / below_bear — measures directional bias |
| `base_mae_pp` | Mean Absolute Error of base (p50) vs actual, in percentage points |
| `regime` | Market regime during test window (bull/bear/neutral) |
| `worst_sector` | Sector with lowest coverage rate |

## Interpreting Results

### Coverage Rate
- **45–55%**: Excellent calibration
- **35–45%** or **55–65%**: Acceptable but indicates slight over/under-confidence
- **<35%**: Model is overconfident (ranges too narrow)
- **>65%**: Model is too conservative (ranges too wide)

### Bias Ratio
- **~1.0**: Symmetric — no directional bias
- **>2.0**: More misses above bull than below bear — likely a bull market period, OR drift shrinkage is too aggressive
- **<0.5**: More misses below bear — likely a bear market period, OR drift prior is too optimistic

### Base MAE
- **<40pp**: Good — median predictions are reasonably close to actuals
- **40–75pp**: Acceptable — stocks are inherently unpredictable
- **>75pp**: Warning — model may have systematic bias

## Known Limitations

1. **Survivorship bias**: The ticker universe reflects today's listings; delisted companies are absent. This slightly overstates model accuracy (failed companies would have worse coverage).

2. **Single horizon**: Only tests 12-month predictions (the GBM path, used for horizons >6 months). The Bootstrap model (≤6 months) is not backtested here.

3. **No FX component**: Tests stock delta (deltaStock) only. The FX scenarios (deltaFx) shown in the app are not validated by this backtest.

4. **Yahoo Finance dependency**: Rate limiting can reduce the sample size below 100 on busy days. G3 gate (≥50 stocks) ensures minimum statistical significance.

5. **Look-back calibration window**: Fixed at 504 days (~2 years). Optimal window length may vary by regime, but a fixed window keeps the test simple and reproducible.

## Financial Validity Assessment

✅ **Walk-forward design** — no look-ahead bias; calibrates only on past data
✅ **Tests production code** — no logic duplication between tested model and deployed model
✅ **Statistical rigor** — 100 stocks per run, coverage testing against known theoretical expectation (50%)
✅ **Regime-aware** — results are contextualized by market conditions
✅ **Conservative acceptance** — [35%, 65%] is a wide gate; a 50% target acknowledges model imperfection
✅ **Reproducible** — seeded PRNG means any run can be replicated given the same date

This backtest provides **genuine signal** about Njord's prediction quality and is not security theater.
