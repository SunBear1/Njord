---
description: Financial mathematics, tax law, bond math, prediction models.
applyTo: "src/utils/**/*.ts,src/workers/**/*.ts"
---

# Financial Calculations

## Belka Tax — 19%

Applies to: capital gains, bond interest, savings interest, dividends

**Tax basis formula (CRITICAL):**
```
taxableGain = (endPriceUSD × nbpMidRate) − (costBasisUSD × nbpMidRateAtPurchase)
```
NBP Table A mid rate only. Date: last business day BEFORE transaction (not transaction date).

Savings: `net = principal + interest × (1 − 0.19)`  
Capitalized bonds: `net = principal + max(0, gross − penalty) × (1 − 0.19)`  
Coupon bonds: each payout taxed at 19%  
Dividends (15% US WHT + 4% Polish additional = 19% total): `net = gross × (1 − 0.19)`

**Bond types (8 types, all capitalized or coupon per table):**
OTS (0.5% penalty, fixed), ROR (0.5%, fixed), DOR (0.7%, variable), TOS (0.7%, fixed), COI (0.7%, inflation), EDO (2.0%, inflation), ROS (2.0%, inflation), ROD (2.0%, inflation)

Monthly compounding: `(1 + rate/12)^months`. Never linear proration.

## FX Math

```
endValue = shares × priceUSD × fxRate
percentage change: (1 + dStock) × (1 + dFx) − 1  [multiply, don't add]
```

Timeline interpolation (geometric): `(1 + delta)^(m/horizon) − 1`  
Breakeven chart: hyperbola grid (not linear).

## Compound Interest

Monthly: `amount × (1 + rate/12/100)^months`  
Fisher (real return): `((1 + nom) / (1 + inflation) − 1) × 100`  
Annualized: `(1 + total)^(1/years) − 1` [geometric mean]

## Dividends

```
gross = shares × priceUSD × yield% × (months/12) × fxRate
net = gross × 0.81
```

## Predictions

**Model selection:** ≤6mo → Bootstrap; >6mo → GBM

**GBM:** `Δ = exp((μ − σ²/2)·T + σ·√T·z) − 1`  
Drift shrinkage: `μ = w·μ_hist + (1−w)·8%`, where `w = min(1, years/10)`  
Damped vol (T>2yr): `σ_eff = σ × max(0.75, 1 − 0.015·(T−2))`  
Quantiles: Student-t(5): Bear p25, Base p50, Bull p75  
Clamp: annual [-80%, +100%], total [-95%, +1000%]

**Bootstrap:** 21-day blocks, 1000 samples, P10/P50/P90. Min 252 days data.

**HMM:** Confidence capped 0.25, UI label "[Informacyjny]", never drive decisions.

## Anti-patterns

- Belka on principal (gain only)
- Kantor rate for tax basis
- Linear timeline (must be geometric)
- Adding deltas (multiply)
- Raw rate compounding (divide by 12)
- Penalty after tax (before)
- Snapshot CPI (use projected)
- "Will do X" text (only scenarios)
- Mean-reversion without shrinkage
- HMM confidence > 0.25
