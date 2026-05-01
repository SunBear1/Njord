---
description: >
  Financial mathematics guardian. Apply when reading or modifying any calculation involving tax,
  bonds, FX, dividends, compound interest, or scenario framing. Ensures correctness of Polish tax
  law application, mathematical soundness of all financial formulas, and realistic probabilistic
  framing of stock predictions.
applyTo: "src/utils/calculations.ts,src/utils/sellAnalysis.ts,src/utils/inflationProjection.ts,src/utils/models/**,src/__tests__/**,src/components/**/*.tsx,functions/api/**"
---

# Financial Mathematics Guardian

> Scope: tax correctness, bond/FX/dividend math, stock market domain knowledge, realistic
> scenario framing.
> For prediction model architecture (GBM calibration, bootstrap, drift shrinkage),
> see `financial-forecasting.instructions.md`.

---

## 1. Core Principle — Stocks Are Not Predictable

**No model, no matter how sophisticated, can tell you with certainty whether a stock will go up
or down.** Historical volatility captures past price swings, but stock prices are driven by
fundamentally unknowable future events.

- ✅ "In the bear scenario, the portfolio loses X PLN compared to the benchmark."
- ✅ "w scenariuszu niedźwiedzia" — probabilistic framing in UI Polish text
- ❌ "The stock will fall by X%." — certainty claim
- ❌ "Expected return is X%." — implies precision that doesn't exist
- ❌ Any UI element that implies a 100% probability outcome

**Every output from the prediction engine is a scenario, not a forecast.**

---

## 2. What the Models Cannot See (Stock Market Domain Knowledge)

GBM and Block Bootstrap are calibrated on historical price volatility only. They are structurally
blind to a long list of real-world drivers:

### Company-Specific Events
- **Earnings surprises** — quarterly results vs analyst consensus; a stock can move ±15–25%
  on earnings day regardless of historical volatility
- **Revenue and margin guidance** — forward guidance often matters more than past results
- **P/E ratio expansion or compression** — multiple re-rating independent of earnings; a stock
  can fall 30% while earnings grow if the market de-rates the sector
- **Management changes** — CEO replacement, CFO departure, board conflicts
- **M&A activity** — acquisition targets jump 20–40%; acquirers often drop 5–10%
- **Share buybacks and dilution** — large buybacks are bullish; secondary offerings dilute EPS
- **Dividend initiation or cut** — yield-seeking investors rebalance on dividend policy changes
- **Analyst upgrades/downgrades** — short-term price catalysts, especially for small/mid caps
- **Insider buying/selling** — legally reported but signals conviction (or lack thereof)

### Macro and Sector Factors
- **Interest rate sensitivity** — growth/tech stocks have long "duration"; they fall when rates
  rise because future cash flows are discounted more heavily (DCF effect)
- **Sector rotation** — capital flows into/out of sectors based on economic cycle (e.g., energy
  outperforms in stagflation; tech underperforms when rates are high)
- **Currency effects beyond USD/PLN** — a US company with European revenue is affected by EUR/USD
- **Commodity input costs** — materials, energy, and transport costs affect margins directly
- **Regulatory and political risk** — antitrust actions, tariffs, sanctions, windfall taxes

### Tail and Systemic Risks
- **Black swans** — pandemics, geopolitical crises, terrorist attacks; not in any historical
  volatility estimate because they are by definition rare and unforeseeable
- **Liquidity crises** — during market stress, bid/ask spreads widen and correlations spike toward
  1.0; diversification fails exactly when needed most
- **Credit events** — bankruptcy, debt restructuring; company-specific but also systemic contagion
- **Flash crashes** — algorithmic trading can cause intraday moves of 5–10% that reverse within
  minutes; irrelevant for long-horizon scenarios but relevant for stop-loss logic

### UI Implication
When showing predictions, consider surfacing a disclaimer that model outputs do not incorporate
earnings calendars, macroeconomic outlook, or any fundamental analysis of the specific company.

---

## 3. Polish Tax Law — Belka (19% Capital Gains Tax)

### 3.1 What Belka Applies To
- Capital gains on stocks (sells above cost basis)
- Interest income on savings accounts (applied per compounding period)
- Bond interest (applied at payout for coupon bonds; at redemption for capitalized bonds)
- Dividend income (handled differently — see §6)

### 3.2 The Tax Basis Rule — CRITICAL
**Polish tax law requires using the NBP Table A mid rate (average rate) for converting USD gains
to PLN for tax purposes.** The kantor/spread rate (what you actually receive when selling) is
higher (less favorable) and is used for the actual cash received — not for the tax calculation.

```
// CORRECT
taxableGainPLN = (endPriceUSD × nbpMidRate) - (costBasisUSD × nbpMidRateAtPurchase)

// WRONG — uses spread rate for tax basis
taxableGainPLN = (endPriceUSD × kantorSellRate) - (costBasisUSD × kantorSellRate)
```

This dual-rate model means:
- **Cash received** = `shares × endPriceUSD × kantorRate` (worse for investor)
- **Taxable gain** = computed at NBP mid rates
- **Net end value** = cash received − capital gains tax (computed at NBP rates)

### 3.2a NBP Rate Lookup Rule
- Use **NBP Table A** mid rate.
- Date: the **last business day STRICTLY BEFORE** the transaction date.
- NOT the transaction date itself. NOT the settlement date.
- If transaction is on Monday → use Friday's rate.
- If Friday was a Polish public holiday → use Thursday's rate.
- Implementation: walk backwards from `(transaction_date − 1 day)` until a valid NBP rate exists.

### 3.2b PIT-38 Grouping
- Group all transactions by **tax year** (calendar year of sell date).
- Report: total revenue, total cost basis, total profit/loss, total tax.
- Losses from year N can be deducted in years N+1 through N+5 (max 50% of loss per year).

### 3.2c RSU / Grant Shares
- Cost basis = 0 (or the taxed value at vest, if provided).
- When `isRSU = true`: entire sell proceeds are profit (minus commissions).

### 3.2d Multi-Currency Transactions
- Supported currencies: USD, EUR, GBP, CHF, DKK, SEK, PLN.
- For PLN transactions: no FX conversion needed, NBP rate = 1.
- For foreign currency: convert BOTH sell price AND cost basis using the appropriate NBP rate.
- Commission in foreign currency: convert using same NBP rate as the transaction.

### 3.3 Belka on Savings Accounts
Tax is applied to **gross interest only**, not to principal:
```
netValue = principal + grossInterest × (1 - 0.19)
```

### 3.4 Belka on Capitalized Bonds (OTS, TOS, EDO, ROS, ROD)
Tax is applied to gain at **redemption only**:
```
effectiveGross = bondGrossValue - earlyRedemptionPenalty
if effectiveGross > principal:
  netValue = principal + (effectiveGross - principal) × (1 - 0.19)
else:
  netValue = effectiveGross  // loss: no tax owed
```

**The penalty is subtracted from the gross value BEFORE computing taxable gain.**
Never apply Belka to a scenario where the bond is redeemed at a loss.

### 3.5 Belka on Coupon Bonds (ROR, DOR, COI)
Each coupon payout is taxed individually at the time of payout:
```
netCoupon = grossCoupon × (1 - 0.19)
```
Then the net coupon is reinvested at the savings account rate. The reinvestment gain is ALSO
subject to Belka when it accrues — applied as a second Belka layer on the reinvestment gain only.

---

## 4. Bond Mathematics — Invariants by Bond Type

| Bond | Coupon freq | Rate year 1 | Rate year 2+ | Penalty | Tax timing |
|------|-------------|-------------|--------------|---------|------------|
| OTS  | 0 (capitalize) | fixed | same fixed | 0.5% | at redemption |
| ROR  | 12 (monthly) | fixed (4%) | NBP ref + 0% | 0.5% | per payout |
| DOR  | 12 (monthly) | fixed (4.15%) | NBP ref + 0.15% | 0.7% | per payout |
| TOS  | 0 (capitalize) | fixed | same fixed | 0.7% | at redemption |
| COI  | 1 (annual)  | fixed (4.75%) | CPI + 1.5% | 0.7% | per payout |
| EDO  | 0 (capitalize) | fixed (5.35%) | CPI + 2.0% | 2.0% | at redemption |
| ROS  | 0 (capitalize) | fixed (5.0%) | CPI + 2.0% | 2.0% | at redemption |
| ROD  | 0 (capitalize) | fixed (5.6%) | CPI + 2.5% | 2.0% | at redemption |

### Key invariants
- Year-by-year compounding uses monthly sub-compounding: `(1 + rate/12)^monthsThisYear`
- Partial years still use monthly compounding — never linear proration of annual rate
- CPI used for inflation bonds must be the **blended projected rate** from `inflationProjection.ts`,
  not the current snapshot rate
- Penalty is deducted from principal (PLN amount) before tax calculation

---

## 5. FX and Dual-Currency Mathematics

### 5.1 Multiplicative Structure
USD portfolio value in PLN is the **product** of three factors:
```
endValuePLN = shares × endPriceUSD × fxRatePLN
```
All three can change independently. Percentage deltas multiply as ratios, they do not add:
```
// CORRECT
endValue = initial × (1 + deltaStock/100) × (1 + deltaFx/100)

// WRONG — additive delta
endValue = initial × (1 + (deltaStock + deltaFx)/100)
```
This matters: +10% stock, +10% FX = +21% combined, not +20%.

### 5.2 The Heatmap (BreakevenChart)
The 2D grid of `deltaStock × deltaFx` correctly models this multiplicative relationship.
Each cell independently varies both factors. Do not "linearize" this grid — the breakeven
boundary is a hyperbola, not a straight line.

### 5.3 Timeline Interpolation — Must Be Geometric
When interpolating a scenario delta at month `m` out of `horizonMonths`:
```typescript
// CORRECT — geometric interpolation (price paths are multiplicative)
const fraction = m / horizonMonths;
const scaledDelta = (Math.pow(1 + params.deltaStock / 100, fraction) - 1) * 100;

// WRONG — linear interpolation (assumes additive process)
const scaledDelta = params.deltaStock * fraction;
```

---

## 6. Dividend Mathematics

### Current Model (Simplified)
Dividends are accumulated over the full horizon using current price as a proxy for the
average portfolio value during the holding period:

```
grossDividendsPLN = shares × currentPriceUSD × (yieldPct/100) × (months/12) × endFxRate
dividendsNetPLN   = grossDividendsPLN × (1 - 0.19)
```

### Tax: WHT + Polish Top-Up = 19% Effective
- US equities: 15% US withholding tax (WHT) under US-Poland tax treaty
- Polish investors owe 19% Belka on dividend income
- Polish tax credits the US WHT: effective additional Polish tax = 19% − 15% = 4%
- Net effect: 19% total (covered by applying a single 19% to gross dividends)

### Known Simplifications (Do Not "Fix" Without Understanding)
- Does not model dividend reinvestment (DRIP) — dividends are treated as cash
- Uses `endFxRate` for FX conversion, not the per-payout rate — this is a deliberate approximation
- Uses `currentPriceUSD` as average base, not a time-weighted average

---

## 7. Compound Interest — Common Pitfalls

### 7.1 Monthly Compounding vs Nominal Annual Rate
```
// CORRECT — monthly compounding
grossEndValue = principal × (1 + annualRate/100/12)^months

// WRONG — simple interest
grossEndValue = principal × (1 + annualRate/100 × months/12)
```
The difference becomes significant over multi-year horizons. Always use exponential compounding.

### 7.2 Percentage Changes Do Not Add
```
// +50% followed by -50% is NOT break-even
1.5 × 0.5 = 0.75  →  -25% total

// Annualized return from total return:
annualized = (1 + totalReturn/100)^(1/years) - 1  ← geometric mean, NOT arithmetic
```

### 7.3 Real vs Nominal Returns — Fisher Equation
```
// CORRECT — Fisher exact formula
realReturn = ((1 + nominalReturn/100) / (1 + inflationRate/100) - 1) × 100

// WRONG — linear approximation (only valid for small values)
realReturn ≈ nominalReturn - inflationRate
```
For inflation > 5% or horizons > 5 years, always use the exact Fisher formula.

---

## 8. Detecting Unrealistic Outputs — Sanity Checks

If any computed value falls outside these ranges, there is a bug or a data issue:

| Metric | Suspicious if... | Likely cause |
|--------|-----------------|--------------|
| Bear scenario return | > 0% | Drift shrinkage not applied; clampScenario skipped |
| Bull scenario return | < 0% | Same |
| Savings account return | < 0% | Negative rate input; check `wibor3mPercent` |
| Bond return < principal | Possible if horizon < 12 months + penalty > interest | Not a bug — expected for short holds |
| Real return > nominal | Inflation input is negative | Check CPI data source |
| Any scenario > +500% for 12 months | Wild drift from raw historical mean; drift shrinkage likely missing |
| Benchmark return > stock bull scenario over 10 years | Plausible but rare — verify scenario deltas are not sign-reversed |

---

## 9. Anti-patterns — Flag These in Code Review

- ❌ **Belka applied to principal** — tax is on gain only; `taxableGain = endValue - costBasis`
- ❌ **Kantor rate used for tax basis** — must be `nbpMidRate`, not `currentFxRate` (which is the
  kantor sell rate)
- ❌ **Linear timeline interpolation** — stock price paths are geometric; use `Math.pow(1+d, fraction)`
- ❌ **Adding percentage deltas** — must multiply ratios: `(1+a)×(1+b)-1`, not `a+b`
- ❌ **Compounding on raw annual rate** — must divide by 12 first: `(1 + r/12)^n`
- ❌ **Penalty applied after tax** — bond penalty reduces gross before Belka is computed
- ❌ **Using snapshot CPI for inflation bonds** — must use blended projected rate
- ❌ **Any UI text claiming a stock "will" do something** — only "in the X scenario"
- ❌ **Benchmark returning < 0 for positive rate inputs** — savings/bonds cannot lose principal
  unless forced by early redemption penalty exceeding accrued interest

---

## 10. Testing Financial Logic

Every financial calculation should be verifiable with a simple numeric example before
being committed. For each function touched, verify:

1. **Zero gain case** — if start == end, tax == 0 and net == gross principal
2. **Small positive gain** — spot-check tax at exactly 19%
3. **Negative scenario** — confirm no tax owed, net == gross loss amount
4. **Long horizon** — confirm compounding grows faster than linear expectation
5. **Scenario monotonicity** — bear < base < bull for any valid input

Run `npm test` to execute the full Vitest suite including `scenarioSanity.test.ts`.

---

## 11. Advisory Notes for New Features

When building any new feature that involves financial projections, ask:

1. **Does this involve a new return stream?** → Apply Belka (19%) to any gain above cost basis
2. **Does this involve USD amounts?** → Need two rates: NBP mid (tax basis) + kantor (cash received)
3. **Does this involve multi-year compounding?** → Use geometric, not linear; use blended rates
4. **Does this involve user-facing numbers?** → Frame as scenarios, add uncertainty language
5. **Is this driven by historical data alone?** → Note that earnings/macro can override history;
   consider adding a caveat or contextual note in the UI

---

## 12. Numerical Precision

### Rounding Rules
- PLN amounts: 2 decimal places, rounded half-up (standard banking).
- USD amounts: 2 decimal places.
- Percentages: 2 decimal places for display, full precision in calculations.
- NBP rates: 4 decimal places (as published by NBP).
- NEVER round intermediate calculations — only round final display values.
- NEVER use `.toFixed()` for financial math — it returns strings and has rounding edge cases.

### Input Limits (Overflow Prevention)
- Maximum shares: 10,000,000.
- Maximum horizon: 144 months (12 years).
- Maximum stock price: $100,000 USD per share.
- Clamp all model outputs via `clampScenario()` to prevent unrealistic values.
