---
description: Financial mathematics, tax law, bond math, prediction models.
applyTo: "src/utils/**/*.ts,src/workers/**/*.ts"
---

# Financial Calculations

## Belka Tax — 19%

Applies to: capital gains, bond interest, savings interest, dividends

**Tax basis (CRITICAL):**
```
taxableGain = (endPriceUSD × nbpMidRate) − (costBasisUSD × nbpMidRateAtPurchase)
```
NBP Table A mid rate only. Date: last business day BEFORE transaction (not transaction date).

Savings: `net = principal + interest × (1 − 0.19)`  
Capitalized bonds: `net = principal + max(0, gross − penalty) × (1 − 0.19)` — penalty before tax  
Coupon bonds: each payout taxed at 19%; reinvestment gain also taxed (second layer on gain only)  
Dividends: 15% US WHT + 4% Polish = 19% total: `net = gross × (1 − 0.19)`

**PIT-38:** Group transactions by tax year. Losses from year N deductible in N+1 to N+5 (max 50% per year).  
**Multi-currency:** USD, EUR, GBP, CHF, DKK, SEK, PLN. For PLN: NBP rate = 1.  
**RSU:** cost basis = 0; entire proceeds are profit.

## Bond Math — Full Invariants

| Bond | Coupon | Rate yr 1 | Rate yr 2+ | Penalty | Tax timing |
|------|--------|-----------|------------|---------|------------|
| OTS  | capitalize | fixed | same fixed | 0.5% | at redemption |
| ROR  | monthly | 4.0% | NBP ref + 0.0% | 0.5% | per payout |
| DOR  | monthly | 4.15% | NBP ref + 0.15% | 0.7% | per payout |
| TOS  | capitalize | fixed | same fixed | 0.7% | at redemption |
| COI  | annual | 4.75% | CPI + 1.5% | 0.7% | per payout |
| EDO  | capitalize | 5.35% | CPI + 2.0% | 2.0% | at redemption |
| ROS  | capitalize | 5.0% | CPI + 2.0% | 2.0% | at redemption |
| ROD  | capitalize | 5.6% | CPI + 2.5% | 2.0% | at redemption |

Monthly sub-compounding: `(1 + rate/12)^monthsThisYear`. Partial years: same (never linear).  
CPI for inflation bonds = blended projected rate from `inflationProjection.ts` (not snapshot).

## FX Math

```
endValue = shares × priceUSD × fxRate
% change: (1 + dStock) × (1 + dFx) − 1  [multiply, never add]
```

Timeline interpolation (geometric): `(1 + delta)^(m/horizon) − 1`  
Breakeven heatmap: hyperbola boundary (not linear).

## Compound Interest

Monthly: `amount × (1 + rate/12/100)^months`  
Fisher (real return): `((1 + nom) / (1 + inflation) − 1) × 100`  
Annualized: `(1 + total)^(1/years) − 1` [geometric mean]

## Dividends

```
gross = shares × priceUSD × yield% × (months/12) × fxRate
net = gross × 0.81
```
Simplifications: no DRIP, uses `endFxRate` (not per-payout), uses `currentPriceUSD` as base.

## Predictions

**Model selection:** ≤6mo → Bootstrap; >6mo → GBM

**GBM:** `Δ = exp((μ − σ²/2)·T + σ·√T·z) − 1`  
Drift shrinkage: `μ = w·μ_hist + (1−w)·8%`, where `w = min(1, years/10)`  
Damped vol (T>2yr): `σ_eff = σ × max(0.75, 1 − 0.015·(T−2))`  
Quantiles: Student-t(5): Bear p25, Base p50, Bull p75  
Clamp: annual [-80%, +100%], total [-95%, +1000%]. Bear always < 0, Bull always > 0.

**Bootstrap:** 21-day blocks, 1000 samples, P10/P50/P90. Min 252 days; fall back to GBM if less.

**HMM:** Confidence capped 0.25, UI label "[Informacyjny]", never drive decisions.  
Monte Carlo: 10k paths in `src/workers/sellAnalysis.worker.ts`. Progress every 1000 paths, send summary stats only.

## Sanity Checks

- Bear > 0%: drift shrinkage / clamp missing
- Bull < 0%: same
- Savings < 0%: check `wibor3mPercent`
- Real > nominal: CPI input negative
- Any 12-month scenario > +500%: raw historical mean, no shrinkage applied

## Numerical Precision

- NEVER round intermediate values — only round final display
- NEVER use `.toFixed()` — returns strings with rounding edge cases
- PLN: 2 decimals half-up. USD: 2 decimals. Percentages: 2 display, full in calc. NBP rates: 4 decimals.
- Input limits: max 10M shares, 144 months, $100K/share. Clamp all model outputs via `clampScenario()`.

## Anti-patterns

- Belka on principal (gain only)
- Kantor rate for tax basis (must use `nbpMidRate`)
- Linear timeline (must be geometric)
- Adding deltas (must multiply ratios)
- Raw annual rate without `/12`
- Penalty after tax (before)
- Snapshot CPI (use projected blended)
- "Will do X" text (only "in the X scenario")
- Raw historical mean without drift shrinkage
- HMM confidence > 0.25
