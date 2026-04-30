# Financial Correctness — Hard Rules

## Tax Law (Polish)

### Belka Tax (Podatek Belki)
- Rate: **19%** flat on capital gains.
- Applied to: **profit only** (sell price − cost basis − commissions). NEVER to principal.
- If profit ≤ 0: tax = 0. Losses can offset gains within the same tax year (PIT-38).
- Tax is calculated per-transaction, then aggregated per tax year.

### NBP Exchange Rate (for tax purposes)
- Use **NBP Table A** mid rate.
- Date: the **last business day STRICTLY BEFORE** the transaction date.
- NOT the transaction date itself. NOT the settlement date.
- If transaction is on Monday → use Friday's rate.
- If Friday was a Polish public holiday → use Thursday's rate.
- Implementation: walk backwards from (transaction_date − 1 day) until a valid NBP rate exists.

### PIT-38 Grouping
- Group all transactions by the **tax year** (calendar year of the sell date).
- Report: total revenue, total cost basis, total profit/loss, total tax.
- Losses from year N can be deducted in years N+1 through N+5 (max 50% of loss per year).

### RSU / Grant Shares
- Cost basis = 0 (or the taxed value at vest, if provided).
- When `isRSU = true`: entire sell proceeds are profit (minus commissions).

### Multi-Currency Transactions
- Supported currencies: USD, EUR, GBP, CHF, DKK, SEK, PLN.
- For PLN transactions: no FX conversion needed, NBP rate = 1.
- For foreign currency: convert BOTH sell price AND cost basis using the appropriate NBP rate.
- Commission in foreign currency: convert using same NBP rate as the transaction.

## Investment Math

### Compound Interest (Savings Account)
```
monthly_rate = annual_rate / 12
value_after_n_months = principal × (1 + monthly_rate)^n
profit = value_after_n_months − principal
tax = profit × 0.19
net_value = value_after_n_months − tax
```
- Capitalization: MONTHLY (this is the Polish savings account standard).
- Belka tax: deducted at withdrawal (end of period), not continuously.

### Stock + FX Returns (Multiplicative)
```
gross_value_PLN = shares × price_USD × (1 + deltaStock) × fx_rate × (1 + deltaFX)
cost_basis_PLN = shares × avg_cost_USD × fx_rate_at_purchase
profit = gross_value_PLN − cost_basis_PLN − commissions
tax = max(0, profit × 0.19)
net_value = gross_value_PLN − tax
```
- CRITICAL: deltas are MULTIPLICATIVE: `(1 + dStock) × (1 + dFX)`. 
- NEVER additive: `dStock + dFX` is WRONG.
- Broker fee (commission) reduces profit, thus reduces tax.

### Bond Math

#### Fixed-Rate Bonds (OTS, TOS)
```
period_rate = annual_rate (fixed for all periods)
value = principal × (1 + period_rate)^periods
```

#### Reference-Rate Bonds (ROR, DOR)
```
year_1_rate = first_year_rate_pct
year_n_rate = nbp_reference_rate + margin_pct  (for n ≥ 2)
```
- Compounded year by year with potentially different rates.

#### Inflation-Linked Bonds (COI, EDO, ROS, ROD)
```
year_1_rate = first_year_rate_pct
year_n_rate = inflation_rate + margin_pct  (for n ≥ 2)
```
- If inflation goes negative: rate = margin_pct (floor at margin, never negative yield).

#### Early Redemption
```
penalty_amount = nominal × early_redemption_penalty_pct
value_after_penalty = accrued_value − penalty_amount
profit = value_after_penalty − principal
tax = max(0, profit × 0.19)
net = value_after_penalty − tax
```
- Penalty subtracted BEFORE tax calculation.
- Some bonds don't allow early redemption — check `early_redemption_allowed` flag.

### Timeline Interpolation
- Between data points: **geometric interpolation**, not linear.
```
value_at_t = start × (end / start)^(t / total_periods)
```
- This reflects compound growth assumptions.
- Linear interpolation would understate returns over long periods.

### Inflation Impact (Fisher Formula)
```
real_return = (1 + nominal_return) / (1 + inflation_rate) − 1
```
- Display both nominal and real values when inflation > 0.
- Purchasing power line: `nominal_value / (1 + inflation)^years`

## Numerical Precision

### Rounding Rules
- PLN amounts: 2 decimal places, rounded half-up (standard banking).
- USD amounts: 2 decimal places.
- Percentages: 2 decimal places for display, full precision in calculations.
- NBP rates: 4 decimal places (as published by NBP).
- NEVER round intermediate calculations — only round final display values.
- NEVER use `.toFixed()` for financial math — it returns strings and has rounding edge cases.

### Overflow Prevention
- Maximum shares: 10,000,000 (prevent overflow in PLN calculations).
- Maximum horizon: 144 months (12 years).
- Maximum stock price: $100,000 USD per share.
- Clamp all model outputs via `clampScenario()` to prevent unrealistic values.

## Forbidden Financial Patterns
- ❌ Applying tax to total value instead of profit
- ❌ Adding percentage returns: `stockReturn + fxReturn` (must multiply)
- ❌ Using transaction date for NBP rate (must be day before)
- ❌ Linear interpolation for timeline charts (must be geometric)
- ❌ Deducting penalty AFTER tax calculation
- ❌ Negative tax amounts (minimum is always 0)
- ❌ Rounding intermediate values before final result
- ❌ Ignoring commission in tax basis calculation
- ❌ Using settlement date instead of trade date for tax year grouping
- ❌ Assuming bonds compound monthly (they compound per-period as defined)
