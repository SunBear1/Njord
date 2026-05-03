# How Njord Calculates Everything

This document explains every financial calculation inside Njord — what it does, why it works that way, and how the numbers are produced. All calculations happen in your browser. The server only fetches prices and exchange rates; it never does any math.

> **Who is this for?**
> Someone who has studied basic investing or personal finance and wants to understand the mechanics behind the app — not just "it calculates your tax" but exactly *how*.

---

## Table of Contents

1. [Key Numbers Used Everywhere](#1-key-numbers-used-everywhere)
2. [Currency Conversion — USD to PLN](#2-currency-conversion--usd-to-pln)
3. [The Belka Tax — Poland's Capital Gains Tax](#3-the-belka-tax--polands-capital-gains-tax)
4. [Stock Scenario Calculator](#4-stock-scenario-calculator)
5. [Comparing Stocks Against Polish Savings Options](#5-comparing-stocks-against-polish-savings-options)
   - [5.1 Savings Account](#51-savings-account)
   - [5.2 Polish Treasury Bonds](#52-polish-treasury-bonds)
   - [5.3 ETF Benchmark](#53-etf-benchmark)
6. [Inflation Projections](#6-inflation-projections)
7. [Stock Price Prediction Models](#7-stock-price-prediction-models)
   - [7.1 GBM — the main model for longer horizons](#71-gbm--the-main-model-for-longer-horizons)
   - [7.2 Block Bootstrap — the main model for shorter horizons](#72-block-bootstrap--the-main-model-for-shorter-horizons)
   - [7.3 HMM — detecting market regimes](#73-hmm--detecting-market-regimes)
   - [7.4 Regime-adjusted drift](#74-regime-adjusted-drift)
   - [7.5 How the best model is chosen](#75-how-the-best-model-is-chosen)
8. [Wealth Accumulation Planner — IKE, IKZE and Regular](#8-wealth-accumulation-planner--ike-ikze-and-regular)
9. [Sell Price Analysis](#9-sell-price-analysis)
10. [Tax Return Calculator — PIT-38](#10-tax-return-calculator--pit-38)
11. [FIFO Lot Matching](#11-fifo-lot-matching)
12. [Where the Data Comes From](#12-where-the-data-comes-from)

---

## 1. Key Numbers Used Everywhere

These constants are referenced throughout the whole app. They come from Polish tax law or widely accepted financial research.

| Name | Value | What it means |
|---|---|---|
| **Belka tax rate** | **19%** | Poland's flat capital gains tax on investment profits |
| **IKZE withdrawal rate** | 10% | Flat tax when you withdraw from an IKZE account after age 65 |
| **US dividend withholding** | 15% | The US withholds 15% from dividends paid to Polish investors (per treaty) |
| **Solidarity levy threshold** | 1,000,000 PLN | Extra 4% tax applies to investment income above this amount |
| **Solidarity levy rate** | 4% | Surcharge on the part of income that exceeds 1 million PLN |
| **IKE annual limit (2026)** | 24,204 PLN | Maximum you can put into an IKE account per year |
| **IKZE annual limit (2026)** | 10,081 PLN | Maximum you can put into an IKZE account per year |
| **Long-run equity return** | 8% per year | Historical average return of US stocks (used as a fallback when data is limited) |
| **NBP inflation target** | 2.5% | Poland's central bank aims to keep inflation at 2.5% in the long run |
| **Trading days per year** | 252 | Stock markets are open roughly 252 days a year |

---

## 2. Currency Conversion — USD to PLN

US stocks are priced in dollars. A Polish investor eventually receives Polish złoty. Njord uses **two different exchange rates** for different purposes — and this distinction matters legally.

### The kantor rate — what you actually receive

When you sell USD shares and convert to PLN, you use the **kantor (exchange bureau) rate** — the actual market rate at the time of conversion. This is used to calculate how many złoty end up in your pocket.

```
Money received = shares × price in USD × kantor rate
```

### The NBP mid rate — what the tax office sees

Polish tax law requires that gains and costs be converted to PLN using the **NBP Table A average rate from the last business day *before* the transaction date**. This is the official National Bank of Poland rate, not the kantor rate, and not the rate on the day itself.

> **Why the day before?** Polish tax law specifically says "the average rate from the last working day preceding the date of receipt of the revenue". This prevents taxpayers from cherry-picking a favourable rate.

Njord fetches this rate automatically from the NBP API. It queries a 14-day window ending the day before your transaction date and uses the most recent rate it finds.

For transactions in PLN (e.g. Warsaw Stock Exchange), no conversion is needed — the rate is simply 1.

### How FX changes are applied in projections

When projecting a future USD/PLN rate, currency changes are applied **multiplicatively**, just like stock prices. A 5% stronger dollar means:

```
projected rate = current rate × 1.05
```

Similarly, a future stock value in PLN is:

```
future PLN value = shares × (price × stock change factor) × (rate × FX change factor)
```

This is more accurate than adding percentages, because each factor compounds on top of the other.

---

## 3. The Belka Tax — Poland's Capital Gains Tax

The "Belka tax" (podatek Belki) is Poland's 19% flat tax on investment profits. It applies to capital gains, bond interest, savings account interest, and dividends.

> **Named after Marek Belka**, Poland's Finance Minister who introduced it in 2002.

### 3.1 Tax on selling stocks

```
Revenue (PLN)         = shares × sale price × NBP rate on sale day-1
Cost (PLN)            = shares × purchase price × NBP rate on purchase day-1
                      + broker fees (both buy and sell, at their respective NBP rates)
Taxable gain (PLN)    = Revenue − Cost
Tax owed              = max(0, taxable gain) × 19%
```

A few important details:
- **Broker commissions are deductible** — they reduce your taxable profit.
- **Losses offset gains** — if you lost money on one stock and made money on another, only the net result is taxed.
- **RSU / free shares**: if the shares were granted at zero cost (like employee stock grants), the entire sale proceeds are profit. Only the sale commission is deductible.

### 3.2 The "switching cost" — making the comparison fair

When Njord compares holding your stock against switching to a Polish savings product, it has to be honest: switching means selling first, which triggers an immediate tax bill on any unrealized gains.

Njord calls this the **switching Belka**:

```
Current stock value (at NBP rate) = shares × current price × NBP rate
Purchase value (at NBP rate)      = shares × purchase price × NBP rate
Unrealized gain                   = current value − purchase value
Switching Belka                   = max(0, unrealized gain) × 19%

What you actually invest in PLN   = current stock value − switching Belka
```

This deduction is applied to all PLN benchmarks (savings, bonds, ETF) so that no option starts with an unfair head start.

### 3.3 Tax on savings interest and bond interest

For savings accounts and most bonds:

```
Gross interest = principal × ((1 + monthly rate) ^ months − 1)
Tax            = gross interest × 19%
Net interest   = gross interest × 81%
```

For **coupon bonds** (bonds that pay regular interest), tax is taken on each payment as it arrives, rather than all at once at the end. For **capitalized bonds** (interest added to principal throughout), tax is taken once at maturity.

---

## 4. Stock Scenario Calculator

**Source file:** `src/utils/calculations.ts`

This is the core of Njord's comparison feature. It asks: *"What might my stocks be worth at the end of my chosen horizon?"* and computes three outcomes — bear (bad), base (expected), and bull (good).

Each scenario is defined by two inputs:
- **`deltaStock`** — how much the stock price changes (e.g. `+30%` or `−15%`)
- **`deltaFx`** — how much the USD/PLN exchange rate changes (e.g. `+5%` means USD strengthened)

### How the final value is calculated

```
Projected price (USD)  = current price × (1 + deltaStock / 100)
Projected FX rate      = kantor rate   × (1 + deltaFx / 100)

Gross proceeds (PLN)   = shares × projected price × projected FX rate
                       − broker fee × projected FX rate

Tax basis (PLN)        = shares × projected price × projected NBP rate
                       − broker fee × projected NBP rate
                       − purchase value (shares × purchase price × current NBP rate)

Capital gains tax      = max(0, tax basis) × 19%

Net proceeds (PLN)     = gross proceeds − capital gains tax + net dividends
```

> **Note:** The scenario calculator uses today's NBP rate for the cost basis — a simplification. In the real PIT-38 calculation (see [Section 11](#11-fifo-lot-matching)), each purchase lot uses the NBP rate from the day before *that* lot was bought.

### Dividends

If the stock pays dividends, those are accumulated over the holding period. The average of the current and projected FX rate is used (since dividends arrive evenly throughout the year, not all at once):

```
Average FX rate   = (current rate + projected rate) / 2
Gross dividends   = shares × current price × annual yield × (months / 12) × average FX rate
Net dividends     = gross dividends × 81%   (after 19% Belka)
```

### Real (inflation-adjusted) returns

Nominal returns look good on paper, but inflation eats into purchasing power. Njord converts to **real returns** using the Fisher equation:

```
Real return = (1 + nominal return) / (1 + cumulative inflation) − 1
```

For example, a 20% nominal gain over 3 years when inflation averaged 5%/year gives a real return of about 14%.

### Month-by-month chart (timeline)

For the trajectory chart, Njord interpolates each scenario to every month from now to the horizon. The interpolation is **geometric** (multiplicative), not linear, because stock prices compound:

```
Scaled delta at month m = ((1 + final delta) ^ (m / total months) − 1) × 100
```

This means the path curves naturally, not linearly.

### Sensitivity heatmap

The heatmap shows every combination of stock price change (−20% to +20%) and FX change (−20% to +20%), each in 4% steps. Each cell is colored to show whether you'd beat your chosen benchmark at that combination.

---

## 5. Comparing Stocks Against Polish Savings Options

All three PLN benchmarks (savings, bonds, ETF) start from the same place: your current stock position value **minus the switching Belka** (see [Section 3.2](#32-the-switching-cost--making-the-comparison-fair)). This ensures the comparison is always apples-to-apples.

### 5.1 Savings Account

A basic Polish savings account earns compound interest, taxed at 19% on the interest each period.

```
Monthly rate     = annual rate / 12
Gross end value  = invested amount × (1 + monthly rate) ^ months
Gross interest   = gross end value − invested amount
Net interest     = gross interest × 81%
Final value      = invested amount + net interest
```

> The rate input is labelled "WIBOR 3M" for historical reasons. In 2025, Poland transitioned to a new benchmark (WIRON), but the field simply represents any savings account rate you enter.

### 5.2 Polish Treasury Bonds

Njord supports all **8 series** of retail Polish Treasury bonds sold at *obligacjeskarbowe.pl*:

| Code | Type | Term | Interest paid |
|---|---|---|---|
| **OTS** | Fixed rate, gains added to principal | 3 months | At maturity |
| **ROR** | Variable (reference rate + margin) | 1 year | Monthly |
| **DOR** | Variable (reference rate + margin) | 2 years | Monthly |
| **TOS** | Fixed rate, gains added to principal | 3 years | At maturity |
| **COI** | Inflation + margin | 4 years | Annually |
| **EDO** | Inflation + margin, gains added to principal | 10 years | At maturity |
| **ROS** | Inflation + margin (800+ family benefit recipients) | 6 years | Annually |
| **ROD** | Inflation + margin, gains added to principal (800+ family benefit recipients) | 12 years | At maturity |

#### How interest rates work

All bonds have a **promotional first-year rate** that is typically higher than the ongoing rate. From year 2 onwards, the rate is:

```
Effective rate = base rate + margin
```

Where the base rate is either:
- A **fixed rate** (locked in at purchase)
- The **NBP reference rate** (follows the central bank rate)
- **Inflation (CPI)** (keeps pace with price rises)

#### Bonds that pay at maturity (capitalized)

Interest compounds monthly each year using the appropriate rate for that year:

```
For each year:
  rate = first-year rate (year 1) or effective rate (year 2+)
  value grows monthly: value × (1 + rate/12) each month

Tax at maturity:
  taxable gain  = final value − invested amount − any early redemption penalty
  tax owed      = max(0, taxable gain) × 19%
```

#### Bonds that pay coupons (ROR, DOR, COI, ROS)

Each coupon is paid, taxed immediately, then assumed to be reinvested in a savings account for the rest of the horizon:

```
For each coupon payment:
  gross coupon   = principal × period rate
  net coupon     = gross coupon × 81%   (Belka taken immediately)
  reinvested for remaining months at savings account rate
  Belka also applies to reinvestment gains
```

#### Early redemption penalty

If you cash out a bond before its maturity date, a penalty (a fixed % of principal) is deducted. No penalty applies if you hold until maturity.

### 5.3 ETF Benchmark

Models buying a Polish-registered ETF after liquidating your stocks. The calculation has two stages of Belka:

1. **Switching Belka** — paid when selling your current stocks (see Section 3.2)
2. **Exit Belka** — paid on the ETF gain when you sell at the horizon

```
Net annual return  = stated annual return − TER (management fee)
Gross end value    = current stock value × (1 + net annual return) ^ years
ETF gain           = gross end value − current stock value
Exit Belka         = max(0, ETF gain) × 19%
Final value        = gross end value − exit Belka − switching Belka
```

---

## 6. Inflation Projections

**Source file:** `src/utils/inflationProjection.ts`

Inflation doesn't stay constant. Njord uses a simple **mean-reversion model** — inflation gradually drifts back toward the NBP's official 2.5% target over time.

### How it works

```
Inflation at month t = 2.5% + (current inflation − 2.5%) × e^(−t / 18)
```

The `18` here is called the **time constant** (τ). It means:
- After about 12 months (half-life), roughly half the gap to 2.5% has closed.
- After ~36 months, inflation is very close to 2.5%.

To get a single "effective annual rate" for a given investment horizon, Njord multiplies month-by-month projected rates into a cumulative factor, then converts back to an annualised rate:

```
Cumulative factor = month 1 rate × month 2 rate × ... × month N rate
Effective annual rate = cumulative factor ^ (1/years) − 1
```

### Savings rate projection

Savings account rates follow the central bank rate, which also reverts to a long-run level over time. Njord models this similarly, with:
- **Long-run equilibrium**: 3% (roughly 65% of the neutral NBP reference rate)
- **Time constant**: 24 months (slower than inflation)

---

## 7. Stock Price Prediction Models

**Source files:** `src/utils/models/`

The Forecast page shows where the stock price might be at the end of your chosen horizon. Three statistical models are used, each with different assumptions. All three output the same thing: five **percentiles** of the possible price change — 5th, 25th, 50th, 75th, and 95th — plus a confidence score.

> **What's a percentile?** The 5th percentile is the outcome where 95% of possibilities are better than this. The 50th percentile (median) is the middle outcome — half of possibilities are above, half below.

### 7.1 GBM — the main model for longer horizons

**Used for:** horizons of **6 months or more**

GBM stands for **Geometric Brownian Motion** — the classical model of stock prices, dating back to the Black-Scholes formula. It assumes that each day's price change is random but drawn from a stable distribution.

The key formula describes how a stock's price might look after time T:

```
End price / Start price = exp( (μ − σ²/2) × T  +  σ × √T × z )
```

Where:
- **μ** (mu) = expected annual return (drift)
- **σ** (sigma) = annual volatility (how wild the swings are)
- **T** = time in years
- **z** = a random number from a Student-t distribution (see below)

#### Fat tails with Student-t

Real stock returns have more extreme events than a normal bell curve predicts. Njord uses a **Student-t distribution with 5 degrees of freedom** instead of a standard normal. This gives the model heavier "tails" — meaning crashes and rallies happen more often than a pure Gaussian model would suggest.

The five percentile values use fixed quantiles from this distribution: `z = −2.015, −0.727, 0, +0.727, +2.015`.

#### Drift shrinkage — handling limited history

If you only have 1 year of price history, the measured drift is noisy and unreliable. Njord blends the historical drift toward an 8% long-run equity prior:

```
Weight = min(1,  data years / 10)
Drift  = weight × historical drift  +  (1 − weight) × 8%
```

With 1 year of data: ~10% weight on history. With 10+ years: 100% weight on history.

#### Volatility damping — long horizons revert

Over very long horizons (5–10 years), stock volatility tends to revert somewhat — big crashes are partly recovered over time. Njord reduces measured volatility slightly for horizons beyond 2 years, down to a minimum of 75% of its original value.

#### Guardrails

To prevent extreme outputs, all scenarios are capped:
- Maximum annual gain: **+100%**
- Maximum annual loss: **−80%**
- Maximum total gain: **+1,000%**
- Maximum total loss: **−95%**

### 7.2 Block Bootstrap — the main model for shorter horizons

**Used for:** horizons **under 6 months**

Bootstrap is a **non-parametric** method — it makes no assumptions about the shape of returns. Instead, it resamples blocks of actual historical daily returns to build thousands of possible future paths.

> **Analogy:** Imagine you have 3 years of past daily returns written on slips of paper. You randomly pick groups of 5–20 consecutive slips, paste them together, and read out the total return. Do this 3,000 times and you have a distribution of possible outcomes.

The block size adapts to the horizon:

```
Block size = min(20,  max(5,  horizon days / 20))
```

Shorter horizons use blocks of 5 days (capturing weekly patterns). Longer horizons use bigger blocks to capture month-long momentum.

Bootstrap automatically captures **fat tails**, **skewness**, and **serial correlation** — without needing to assume any specific distribution. This makes it excellent for short horizons where the historical data is most directly applicable.

**Requires at least 20 days of historical data.**

### 7.3 HMM — detecting market regimes

**HMM = Hidden Markov Model**

The market doesn't behave the same way all the time. Sometimes it's in a calm, trending **bull** state. Sometimes it's in a volatile, falling **bear** state. HMM tries to detect which state we're currently in.

**Important:** HMM does **not** drive the bear/base/bull scenario numbers. It is used for:
1. Displaying the current regime label in the Forecast UI
2. Running full price-path simulations in the Sell Analysis feature

#### How HMM works

The model assumes there are exactly **2 hidden states** (bear and bull), each with its own average daily return and volatility. It fits these states to historical daily returns using the **Baum-Welch algorithm** (a type of Expectation-Maximization):

1. **Guess** initial means and volatilities for each state
2. **E-step**: use the Forward-Backward algorithm to estimate the probability of being in each state at each historical date
3. **M-step**: update the state parameters based on those probabilities
4. Repeat until the model stops improving (up to 100 iterations)
5. Run 12 times with different random starting points; keep the best result

After fitting, the model:
- Labels each state as "bear" or "bull" (the one with higher average return = bull)
- Reports the probability of currently being in each state
- Shows how long each regime typically lasts (expected duration in trading days)

**Requires at least 250 days of historical data. Confidence is capped at 25%** — it is displayed as extra context, never recommended as the primary model.

### 7.4 Regime-adjusted drift

When HMM detects a strong current regime, the GBM model's drift prior is adjusted to reflect it:

| HMM signal | Prior used in GBM |
|---|---|
| Strong bull (>70% confident) | 12% annual drift |
| Strong bear (<30% confident in bull) | 3% annual drift |
| Uncertain / transitional | 8% annual drift (default) |

This links the two models without giving HMM direct control — it merely nudges the GBM's starting assumption.

### 7.5 How the best model is chosen

The model selector runs an **out-of-sample backtest** on recent historical data:

1. Split history into many rolling windows
2. Run each model on the earlier part, check whether the later part fell within the model's 5th–95th percentile range
3. Score each model: the **coverage score** is the fraction of windows where the actual outcome was inside the predicted range
4. A perfect model scores 0.90 (90%) — it should capture 90% of outcomes
5. The model whose score is closest to 90% is recommended

The routing rule:
- **< 6 months** → Bootstrap is recommended
- **≥ 6 months** → GBM is recommended

---

## 8. Wealth Accumulation Planner — IKE, IKZE and Regular

**Source file:** `src/utils/accumulationCalculator.ts`

The Portfolio page simulates saving money every month into one or more **tax-advantaged accounts**, over a multi-year horizon. It's designed to show how Polish investment wrappers change the outcome over time.

### The three wrappers

| Wrapper | Tax during accumulation | Tax when you withdraw | Notes |
|---|---|---|---|
| **IKE** (Individual Retirement Account) | None on dividends | **0%** | Completely tax-free at age 60+ |
| **IKZE** (Individual Retirement Security Account) | None on dividends | **10% flat** on total value | Contributions reduce your annual income tax (PIT deduction) |
| **Regular brokerage** | 19% on each dividend payment | **19% on gains** | Standard taxed account |

### How contributions are split

Monthly contributions fill wrappers in order — IKE first, then IKZE, then the regular account gets everything that doesn't fit:

```
IKE receives:     min(remaining, IKE annual limit / 12)
IKZE receives:    min(remaining, IKZE annual limit / 12)
Regular receives: whatever is left
```

### Simulating a stocks portfolio month by month

Each month:
1. The contribution is invested (minus a small FX spread if buying USD stocks)
2. The whole portfolio grows by the expected monthly stock return
3. Dividends are generated and reinvested (Belka is deducted first for a regular account; IKE and IKZE are tax-free during accumulation)

```
monthly return   = (1 + annual return%) ^ (1/12) − 1
gross dividends  = portfolio value × (annual yield% / 12)
net dividends    = gross dividends × 81%   (regular only; 100% for IKE/IKZE)
```

### Simulating a bond portfolio month by month

Each monthly contribution buys a fresh "cohort" of bonds. Every cohort grows at the bond's applicable rate. When a cohort reaches its maturity date:
- **Regular account**: Belka is taken from the gain, then proceeds are reinvested
- **IKE / IKZE**: no tax at maturity — the whole amount rolls over

Year 1 uses the promotional first-year rate; year 2+ uses the effective (base + margin) rate.

### Simulating a savings account month by month

Each month, interest is earned and immediately taxed (regular account only):

```
interest = current balance × monthly rate
tax      = interest × 19%   (regular account; 0 for IKE/IKZE)
balance  = balance + monthly contribution + interest − tax
```

### Exit tax at the end

When you withdraw everything at the end of the horizon:

| Wrapper | Calculation |
|---|---|
| IKE | No tax |
| IKZE | 10% × total withdrawal |
| Regular brokerage | 19% × max(0, gross value − total contributed) |

### The IKZE bonus — PIT tax deduction

Every year you contribute to IKZE, you can deduct that amount from your taxable income. If you're in the 32% income tax bracket, contributing 10,000 PLN saves you 3,200 PLN in income tax that year.

Njord models this by assuming you invest those savings in a savings account:

```
Annual deduction = IKZE contribution × income tax rate (12% or 32%)
Deduction invested for (horizon − year) remaining years at savings rate
Belka applies to the savings account growth
```

The total of all these reinvested deductions is added to the IKZE final value.

### The counterfactual — "what if I just used a regular account?"

To show how much IKE/IKZE actually helps, Njord calculates what would happen if you put everything into a regular brokerage account instead (same instrument, same monthly amount, same horizon). The difference is the **tax saving**.

### Purchasing power

Njord also tracks the **inflation-eroded value** of your contributions — what the money you put in would be worth in today's prices, shrinking year by year due to inflation:

```
Real value of contributions = total contributed / (1 + inflation rate) ^ years
```

---

## 9. Sell Price Analysis

**Source file:** `src/utils/sellAnalysis.ts`

The Sell Analysis page helps answer: *"At what price should I set a sell order, and what's the chance it gets hit?"*

It runs **10,000 simulated price paths** using the fitted HMM model (see [Section 7.3](#73-hmm--detecting-market-regimes)) and analyses where prices end up.

### Step 1 — Simulate 10,000 price paths

Each simulated path steps forward day by day:

```
Each day:
  random daily return = state mean + state volatility × random normal number
  price next day      = price today × exp(random daily return)
  
  With some probability, the market regime switches (bear ↔ bull)
  — the probability comes from the fitted HMM transition matrix
```

All 10,000 paths start from the same current price and the same current regime.

### Step 2 — Calculate "touch probabilities"

Target prices are generated from **−25% to +40%** in 5% steps. For each target:

- **Upside targets**: what fraction of paths *ever reach or exceed* this price during the horizon?
- **Downside targets**: what fraction of paths *ever fall to or below* this price?

```
Touch probability = number of paths that hit the target / 10,000
```

The average day on which paths first hit the target is also recorded.

### Step 3 — Calculate expected value with a time bonus

Hitting a target early is better than hitting it late — because you can reinvest the proceeds sooner. Njord applies a **time bonus** using a 4% annual risk-free rate (roughly the NBP rate):

```
Time bonus       = 1 + 4% × (remaining days after touch / 252)
Expected value   = touch probability × target price × time bonus
                 + (1 − touch probability) × median final price
```

The **optimal target** is whichever price has the highest expected value.

### Step 4 — Fan chart

At each day of the horizon, Njord records the 10th, 25th, 50th, 75th, and 90th percentile prices across all 10,000 paths. These form the fan-shaped chart showing the spread of possible outcomes widening over time.

### Downside risk

The fraction of paths where the final price is **below the current price** is shown as the "downside risk at horizon" — i.e., the probability of being worse off after the holding period.

---

## 10. Tax Return Calculator — PIT-38

**Source file:** `src/utils/taxCalculator.ts`

The Tax page helps a Polish investor calculate their annual capital gains tax return (PIT-38 form).

### Calculating tax on a single stock sale

```
Revenue (PLN)    = shares sold × sale price × NBP rate on day before sale
Cost (PLN)       = (shares × purchase price + buy commission) × NBP rate on day before purchase
                 + sell commission × NBP rate on day before sale
Gain/Loss (PLN)  = Revenue − Cost
Tax estimate     = max(0, gain) × 19%
```

**RSU / free shares:** cost is zero. Only the sell commission is deductible.

### Calculating tax on dividends

The US withholds 15% of dividends from Polish investors at source (under the US-Poland tax treaty). Poland's tax on dividends is 19%. The result: you usually only pay the remaining 4% top-up to the Polish tax office.

```
Gross dividend (PLN)   = dividend amount × NBP rate
Full Polish tax        = gross dividend × 19%
US tax already paid    = min(US withholding × NBP rate, full Polish tax)
Top-up to Poland       = full Polish tax − US tax already paid
```

### Netting gains and losses

Losses on some trades reduce the tax on gains from others — you are taxed on the **net** result:

```
Net income = total gains − total losses
Tax owed   = max(0, net income) × 19%
```

### Solidarity levy (DSF-1)

If your net investment income in a year exceeds **1,000,000 PLN**, a separate 4% levy applies to the excess:

```
Solidarity levy = (net income − 1,000,000 PLN) × 4%
```

This is filed on a separate DSF-1 form, not on PIT-38.

### PIT-38 form sections

The calculator maps values to the official PIT-38 form fields (version 18):

| Section | Content |
|---|---|
| **Section C** | Revenue and costs, split between domestic (Warsaw Stock Exchange / PLN) and foreign sources |
| **Section D** | Net income, prior-year loss deductions, tax base, tax due |
| **Section G** | Dividends, foreign withholding credits, final tax |

### PIT/ZG — foreign income attachment

If you traded stocks priced in a foreign currency (USD, GBP, etc.), you must attach a **PIT/ZG** form for each country where income was sourced. Njord automatically groups your transactions by currency and maps each to a country:

| Currency | Country on PIT/ZG |
|---|---|
| USD | United States |
| GBP | United Kingdom |
| CHF | Switzerland |
| DKK | Denmark |
| SEK | Sweden |

PIT/ZG is only required when the net income for that country is positive. Losses in foreign currencies are included in the overall PIT-38 calculation but don't require a separate attachment.

---

## 11. FIFO Lot Matching

**Source file:** `src/utils/fifoEngine.ts`

When you sell shares you've bought in multiple batches at different prices, Polish tax law says you must use **FIFO — First In, First Out**. This means the oldest shares you own are treated as the first ones sold.

> **Why does this matter?** Different purchase batches have different prices (cost bases), so the taxable gain depends on which batch you're selling from. FIFO is the legally required method in Poland.

### How it works

1. All purchase lots for each stock are sorted from oldest to newest
2. Sell transactions are processed in chronological order
3. Each sell consumes the oldest available lots first, partial lots are allowed
4. Each lot uses the **NBP rate from the day before its own purchase date** for cost conversion

```
For each sell:
  Revenue (PLN)  = shares sold × sale price × sale NBP rate
  Cost (PLN)     = Σ (consumed shares × lot purchase price × lot's own NBP rate)
                 + (buy and sell broker fees at their respective NBP rates)
  Gain/Loss      = Revenue − Cost
  Tax            = max(0, gain) × 19%
```

For RSU / zero-cost lots: cost = 0, only the sale commission is deductible.

---

## 12. Where the Data Comes From

| Data | Source | Cached? |
|---|---|---|
| Current stock price (USD) | Yahoo Finance (via Njord's backend proxy) | Yes — 1 hour |
| Historical daily prices | Yahoo Finance (via Njord's backend proxy) | Yes — 1 hour |
| Live USD/PLN sell rate | NBP API (direct from your browser) | No |
| NBP Table A mid rate for a specific date | NBP API (`api.nbp.pl`) | No — fetched per transaction |
| Polish Treasury Bond rates and terms | `public/polish_treasury_bonds.csv`, sourced from *obligacjeskarbowe.pl* | — |
| Current inflation rate | Entered by the user | — |
| Current savings rate | Entered by the user | — |

**Caching:** Stock prices are cached at the Cloudflare edge for 1 hour to avoid hitting Yahoo Finance on every page load.

**Yahoo Finance** is the primary data source and requires no API key. If Yahoo Finance rate-limits the server (HTTP 429), a **Twelve Data** fallback is used — this requires an optional API key configured on the server.

**Bond data** is updated manually from the Polish Treasury's website when rates change. The last update date is shown in the app's bond selector. Rates may be slightly out of date between manual refreshes.
