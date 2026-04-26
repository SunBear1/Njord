# AGENTS.md — Njord

Instructions for AI agents working with this repository.

## Project overview

**Njord** is a React/TypeScript SPA (Single Page Application) with three main tabs:

1. **Investment comparison** — compares a USD-denominated stock/ETF portfolio against Polish savings instruments (savings accounts or government bonds).
2. **Belka tax calculator** — calculates Polish 19% capital gains tax (Belka) for multiple stock sale transactions, with automatic NBP Table A rate fetching and PIT-38 grouping.
3. **Kreator portfela** (Portfolio Creator) — a 4-step wizard for building a long-term passive investment portfolio across IKE, IKZE, and regular brokerage accounts with multi-instrument allocation.

All computations run in the browser — no backend.

- **Live demo:** https://njord.pages.dev
- **UI language:** Polish
- **Base currency:** PLN (converted from USD via NBP exchange rate)

---

## Tech stack

| Tool | Version | Role |
|------|---------|------|
| React | 19 | UI framework |
| TypeScript | 6 | Language |
| Vite | 8 | Bundler + dev server |
| Tailwind CSS | v4 | Styling (utility-first) |
| Recharts | 3 | Charts |
| Lucide React | 1 | Icons |

---

## Commands

```bash
npm run dev        # dev server -> http://localhost:5173/
npm run dev:full   # full stack: Vite + Pages Functions at localhost:8788
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # preview production build
```

Local dev with Pages Functions (optional — only needed for Twelve Data fallback):
```ini
# .dev.vars — gitignored, optional
TWELVE_DATA_API_KEY=your_key  # Only needed as fallback when Yahoo Finance rate-limits
```
Without `.dev.vars`, `/api/analyze` works via Yahoo Finance with no configuration needed.

---

## File structure

```
src/
├── App.tsx                       # Root component, all app state lives here; three tabs: investment + tax + portfolio
├── components/
│   ├── InputPanel.tsx            # Left panel: ticker, shares, FX, benchmark selector, horizon slider
│   ├── ScenarioEditor.tsx        # 3-scenario editor (bear/base/bull) + historical volatility suggestions
│   ├── VerdictBanner.tsx         # Results summary (which scenarios beat the benchmark)
│   ├── ComparisonChart.tsx       # Bar chart: stocks vs benchmark end value
│   ├── TimelineChart.tsx         # Line chart: portfolio value over time
│   ├── BreakevenChart.tsx        # Heatmap: stock delta × FX delta — where stocks beat benchmark
│   ├── AccumulationChart.tsx     # Stacked area chart for accumulation/portfolio results
│   ├── SellAnalysisPanel.tsx     # Optimal sell-price analysis (lazy-loaded, uses HMM Monte Carlo)
│   ├── TaxCalculatorPanel.tsx    # Belka tax calculator — multi-transaction, NBP auto-fetch, PIT-38
│   ├── KantorSidebar.tsx         # Exchange rate sidebar (shown on investment tab only)
│   ├── ErrorBoundary.tsx         # React error boundary wrapper
│   ├── MethodologyPanel.tsx      # Calculation methodology explanation
│   ├── HowItWorks.tsx            # User guide / how-to
│   ├── AuthModal.tsx             # Login/register modal (email + OAuth providers)
│   ├── AccountPanel.tsx          # Account settings (change password, delete account, linked providers)
│   ├── UserMenu.tsx              # Header user menu (avatar, login/logout)
│   └── portfolio/                # 4-step portfolio wizard ("Kreator portfela")
│       ├── PortfolioWizard.tsx   # Orchestrator: wires steps + state + navigation
│       ├── WizardStepper.tsx     # 4-step progress bar with numbered circles
│       ├── WizardNavigation.tsx  # Wstecz/Dalej navigation buttons
│       ├── Step1PersonalData.tsx # Monthly amount, horizon, PIT bracket, toggles
│       ├── Step2BrokerSelection.tsx # IKE/IKZE broker card selection
│       ├── Step3Allocation.tsx   # Multi-instrument allocation sliders per wrapper
│       └── Step4Summary.tsx      # Metric cards, chart, annual table, counterfactual
├── hooks/
│   ├── useAssetData.ts           # Fetch stock + analysis data from /api/analyze
│   ├── useAuth.ts                # JWT auth state — login, logout, register, OAuth, user session
│   ├── useEtfData.ts             # Fetch ETF data from /api/analyze
│   ├── useCurrencyRates.ts       # Multi-currency rates via /api/currency-rates (Alior + NBP fallback)
│   ├── useInflationData.ts       # ECB HICP CPI for Poland via /api/inflation
│   ├── useBondPresets.ts         # Bond presets from /api/bonds (CSV-backed)
│   ├── usePortfolioState.ts      # Portfolio-level state management
│   ├── useSellAnalysis.ts        # HMM-based sell-price Monte Carlo analysis
│   ├── useHistoricalVolatility.ts # GBM/Bootstrap scenario suggestions from price history
│   ├── useWizardState.ts         # Portfolio wizard state management (localStorage: njord_portfolio_wizard)
│   ├── useDarkMode.ts            # Dark mode toggle with localStorage persistence
│   └── useDebouncedValue.ts      # Debounce helper for slider/model inputs
├── providers/
│   ├── twelveDataProvider.ts     # Calls /api/analyze and translates errors to Polish messages
│   └── nbpProvider.ts            # NBP USD/PLN mid rate (direct, for live FX display)
├── data/
│   └── bondPresets.ts            # Bond metadata constants (dates, source URL); rates loaded from CSV via /api/bonds
├── utils/
│   ├── calculations.ts           # Investment comparison logic (pure functions)
│   ├── accumulationCalculator.ts # Accumulation + portfolio wizard calculations (pure functions)
│   ├── allocationValidation.ts   # Allocation slider validation (sum to 100%, normalize, adjust)
│   ├── taxCalculator.ts          # Belka tax logic: calcTransactionResult, calcMultiTaxSummary
│   ├── fetchNbpTableARate.ts     # NBP Table A mid rate fetch (last business day before date)
│   ├── fetchTickerName.ts        # Resolves ticker symbol → company name via /api/analyze
│   ├── etradeParser.ts           # Parses Etrade "Gains & Losses" .xlsx exports into TaxTransaction[]
│   ├── parseBondPresets.ts       # Parses bond presets from CSV
│   ├── sellAnalysis.ts           # Monte Carlo sell analysis (HMM paths, target generation)
│   ├── inflationProjection.ts    # Mean-reversion CPI projection (Fisher formula)
│   ├── hmm.ts                    # 2-state Gaussian HMM (Baum-Welch EM) for regime detection
│   ├── persistedState.ts         # localStorage persistence (njord_state v4, with migrations)
│   ├── assetConfig.ts            # Constants (DEFAULT_HORIZON_MONTHS = 12)
│   ├── formatting.ts             # Number formatting (fmtUSD, fmtPLN, fmtNum)
│   ├── fetchWithTimeout.ts       # fetch() wrapper with configurable timeout
│   ├── brokerParsers/types.ts    # Shared types for broker import parsers
│   └── models/
│       ├── gbmModel.ts           # Calibrated GBM with drift shrinkage + damped volatility
│       ├── bootstrap.ts          # Block Bootstrap for short horizons (≤6 months)
│       ├── hmmModel.ts           # HMM-based scenario generation (informational only)
│       └── types.ts              # Shared model types (ModelOutput, ScenarioSuggestion)
├── workers/
│   └── sellAnalysis.worker.ts    # Web Worker for HMM Monte Carlo offloading (NOT a Cloudflare Worker)
├── types/
│   ├── scenario.ts               # ScenarioKey, BenchmarkType, BondPreset, ScenarioResult
│   ├── asset.ts                  # AssetData, HistoricalPrice
│   ├── analyze.ts                # AnalyzeResponse, AnalyzeResult (Pages Function response types)
│   ├── accumulation.ts           # BucketConfig, AccumulationResult, AnnualTableRow
│   ├── portfolio.ts              # Broker, WizardState, ETF_PRESETS, PortfolioAllocation
│   ├── tax.ts                    # TaxTransaction, TransactionTaxResult, MultiTaxSummary, TaxInputs
│   ├── auth.ts                   # User, AuthState, AuthError types
│   └── sellAnalysis.ts           # SellAnalysisResult, TargetPrice, PathDistribution
functions/
├── _middleware.ts                # Global CORS + Content-Type for all /api/* routes
└── api/
    ├── analyze.ts                # GET /api/analyze?ticker=X — Yahoo Finance + NBP FX
    ├── bonds.ts                  # GET /api/bonds — serves bond presets CSV (cached 24h)
    ├── currency-rates.ts         # GET /api/currency-rates — Alior Kantor + NBP Table C proxy
    ├── inflation.ts              # GET /api/inflation — ECB HICP CPI proxy (cached 24h)
    └── auth/                     # Authentication routes (JWT + OAuth)
        ├── _utils/               # Shared auth helpers (cookie.ts, jwt.ts, password.ts, types.ts)
        ├── register.ts           # POST /api/auth/register
        ├── login.ts              # POST /api/auth/login
        ├── logout.ts             # POST /api/auth/logout
        ├── me.ts                 # GET /api/auth/me — current user from JWT cookie
        ├── change-password.ts    # POST /api/auth/change-password
        ├── delete-account.ts     # POST /api/auth/delete-account
        ├── github/index.ts       # GET /api/auth/github — initiate GitHub OAuth
        ├── github/callback.ts    # GET /api/auth/github/callback — GitHub OAuth callback
        ├── google/index.ts       # GET /api/auth/google — initiate Google OAuth
        └── google/callback.ts    # GET /api/auth/google/callback — Google OAuth callback
```

---

## External APIs

| API | URL | Purpose | CORS | Auth |
|-----|-----|---------|------|------|
| Yahoo Finance | `query1.finance.yahoo.com/v8/finance/chart/` | Stock/ETF prices, 2yr history — **primary** | Server-side only | None (User-Agent required) |
| Twelve Data | `api.twelvedata.com/time_series` | Stock prices — **fallback on Yahoo 429** | Yes | Optional API key |
| NBP Table A | `api.nbp.pl/api/exchangerates/rates/a/` | Mid rate for tax basis (Belka calculator) | Yes | None |
| NBP Table C | `api.nbp.pl/api/exchangerates/rates/c/` | Sell/buy rates for display (KantorSidebar) | Yes | None |
| Alior Kantor | `klient.internetowykantor.pl/api/public/marketBrief/` | Live kantor rates (USD/EUR/GBP/CHF/etc.) | Yes | None |
| ECB HICP | `data-api.ecb.europa.eu/service/data/ICP/...` | Polish CPI inflation | Yes | None |

**Data source strategy:** Yahoo Finance is the primary source for market data (no key required).
If Yahoo returns 429 (rate limited), `/api/analyze` falls back to Twelve Data when
`TWELVE_DATA_API_KEY` is configured. Both sources produce identical response shape.
The `source` field in `ProxyResponse` indicates which was used.

---

## Authentication

JWT-based auth with HttpOnly cookies, backed by Cloudflare D1 (SQLite). Supports email/password registration and OAuth (GitHub, Google).

**Components:**
- `AuthModal.tsx` — login/register modal (email + OAuth providers)
- `AccountPanel.tsx` — account settings (change password, delete account, linked providers)
- `UserMenu.tsx` — header avatar, login/logout actions

**Hook:** `useAuth.ts` — manages auth state (user session, login, logout, register, OAuth redirects)

**Backend:** 10 routes under `functions/api/auth/` (see file structure above). Shared helpers in `functions/api/auth/_utils/` (JWT signing/verification, password hashing, cookie management).

**Database:** Cloudflare D1. Schema in `migrations/0001_create_users.sql`.

**Required environment variables** (CF Pages secrets + `.dev.vars` for local):
- `JWT_SECRET` — signing key for auth tokens
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth app credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth app credentials

**Types:** `src/types/auth.ts` — `User`, `AuthState`, `AuthError`

---

## Calculation logic

All financial logic is in `src/utils/calculations.ts` (pure functions). Key rules:
- **Belka tax:** 19% on profit only — never applied to principal
- **Bonds:** year-by-year compounding, early redemption penalty subtracted **before** tax
- **FX + stock deltas are multiplicative**, not additive: `(1 + dS) × (1 + dFX) - 1`
- **Timeline interpolation is geometric**, not linear

> For complete rules (tax basis, bond math, compound interest, anti-patterns):
> see `.github/instructions/financial-math-guardian.instructions.md`

---

## Bond presets

Bond data is loaded at runtime from `public/polish_treasury_bonds.csv` via `GET /api/bonds` (cached 24h). The CSV is the single source of truth for rates, margins, penalties, and maturity. `src/data/bondPresets.ts` exports only metadata constants (`BOND_PRESETS_LAST_UPDATED`, `BOND_PRESETS_SOURCE_URL`).

8 bond types are defined in the CSV: OTS, ROR, DOR, TOS, COI, EDO, ROS, ROD.

CSV columns: `id`, `name_pl`, `maturity_months`, `rate_type`, `first_year_rate_pct`, `margin_pct`, `coupon_frequency`, `early_redemption_allowed`, `early_redemption_penalty_pct`, `is_family`.

> Source: https://www.obligacjeskarbowe.pl/oferta-obligacji/

`BondRateType` (`rate_type` column): `fixed` | `reference` | `inflation`

Effective rate for years 2+:
- `fixed` → `first_year_rate_pct` (unchanged)
- `reference` → `nbpRefRate + margin_pct`
- `inflation` → `inflationRate + margin_pct`

### Adding/updating bond presets
1. Edit `public/polish_treasury_bonds.csv` with new rates
2. Update `BOND_PRESETS_LAST_UPDATED` in `src/data/bondPresets.ts`
3. The app reads the CSV via `/api/bonds` — no code changes needed for rate updates

---

## App state (App.tsx)

All state lives in `App.tsx` and is passed to components via props. No global store (Redux/Zustand).

**Active section:**

| State | Type | Description |
|-------|------|-------------|
| `activeSection` | `'investment' \| 'tax' \| 'portfolio'` | Which tab is shown; persisted to localStorage |

**Investment comparison inputs:**

| State | Type | Description |
|-------|------|-------------|
| `ticker` | `string` | Stock/ETF symbol (e.g. `'AAPL'`) |
| `shares` | `number` | Number of shares held |
| `avgCostUSD` | `number` | Average purchase price per share in USD |
| `isRSU` | `boolean` | RSU/grant shares — zero cost basis flag |
| `brokerFeeUSD` | `number` | Total broker commission on the sale in USD |
| `dividendYieldPercent` | `number` | Annual dividend yield % (for return calculation) |
| `horizonMonths` | `number` | 1–144, default 12; max 60 for savings mode |
| `benchmarkType` | `BenchmarkType` | `'savings'`, `'bonds'`, or `'etf'` |
| `scenarios` | `Scenarios` | bear/base/bull: deltaStock + deltaFx in % |
| `wibor3m` | `number` | Savings account interest rate, % annual |
| `bondSettings` | `BondSettings` | Bond rate, penalty, maturity months |
| `nbpRefRate` | `number` | NBP reference rate in % |
| `inflationRate` | `number` | CPI inflation, % annual (auto-fetched from ECB) |

**ETF benchmark inputs:**

| State | Type | Description |
|-------|------|-------------|
| `etfTicker` | `string` | ETF symbol for benchmark |
| `etfAnnualReturnPercent` | `number` | Manual override for ETF annual return |
| `etfTerPercent` | `number` | ETF total expense ratio % |

**State persistence:** `src/utils/persistedState.ts` — `njord_state` key, schema v3. All investment inputs are persisted. Tax transactions are stored separately under `njord_tax_transactions`.

---

## Conventions

- **UI language:** Polish (labels, error messages, descriptions) — this is the ONLY place Polish is used
- **Code language:** English (variable names, function names, comments, type names)
- **Commit messages:** English, following [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Documentation:** English (README.md, AGENTS.md, code comments, JSDoc)
- **Styling:** Tailwind CSS v4 only (utility classes); no CSS modules or styled-components. Semantic color tokens are defined in `src/index.css` via `@theme` — use them when available, add new ones when needed.
- **Components:** Functional with hooks; no classes; props explicitly typed via interfaces
- **No routing** — single-page application with three tabs (`activeSection` state)
- **Testing:** Vitest (`npm test` / `npm run test:watch`). Tests in `src/__tests__/`. 446 tests across 17 files.
- **Deploy:** Automatic on `main` push via **Cloudflare Pages** native GitHub integration (no GH Actions workflow)
- **Backend:** `functions/api/analyze.ts` — CF Pages Function. Primary: Yahoo Finance (no key). Fallback: Twelve Data on 429. All financial computation runs client-side.
- **Base path:** `/` (Cloudflare Pages serves from root)
- **Agent docs:** `AGENTS.md` at repo root — this is the standard location for GitHub Copilot and other AI agents.

---

## Common tasks

### Adding a new bond type
1. Add a row to `public/polish_treasury_bonds.csv`
2. Ensure `rate_type` is one of `fixed`, `reference`, `inflation`
3. Verify `maturity_months <= 144` (slider max for bonds mode)
4. Update `BOND_PRESETS_LAST_UPDATED` in `src/data/bondPresets.ts`

### Changing horizon slider range
- `src/components/InputPanel.tsx`: find the `max=` prop on the horizon slider — `max={benchmarkType === 'savings' ? 60 : 144}`
- `src/App.tsx`: find the clamping logic on savings mode switch (search for `Math.min` near `horizonMonths`)
- Slider ticks are absolutely positioned — update tick arrays accordingly

### Changing calculation logic
- Only `src/utils/calculations.ts` — pure functions, no side effects
- Key functions: `calcAllScenarios`, `calcTimeline`, `calcHeatmap`

### Adding a new chart
- Create component in `src/components/`
- Data from `calcTimeline`/`calcHeatmap`/`calcAllScenarios` — pass via props from App.tsx
- Use Recharts (see existing chart components as examples)

### Working on the Belka tax calculator
- **UI:** `src/components/TaxCalculatorPanel.tsx` — all UI and state for the tax tab lives here. Tax transactions are stored in `localStorage` under `njord_tax_transactions` (separate from the main app state).
- **Calculations:** `src/utils/taxCalculator.ts` — pure functions `calcTransactionResult` and `calcMultiTaxSummary`. Logic: NBP mid rates for tax basis, Belka = 19% on gain, losses offset gains per PIT-38.
- **NBP rate fetch:** `src/utils/fetchNbpTableARate.ts` — queries NBP Table A for the last business day strictly before the transaction date. Returns `{ rate, effectiveDate }`.
- **Ticker lookup:** `src/utils/fetchTickerName.ts` — resolves a ticker symbol to a company name via `/api/analyze`.
- **Etrade import:** `src/utils/etradeParser.ts` — parses Etrade "Gains & Losses" `.xlsx` exports into `TaxTransaction[]`. SheetJS is dynamically imported on first use (lazy chunk).
- **Tax law rule:** Use NBP Table A mid rate from the **last business day before** the transaction date, not the transaction date itself. This is a Polish tax law requirement.
- **KantorSidebar is hidden on the tax and portfolio tabs** — `App.tsx` conditionally renders it only on the investment tab.

### Working on the Portfolio Creator (Kreator portfela)
- **UI:** `src/components/portfolio/` — 4-step wizard: Step1PersonalData → Step2BrokerSelection → Step3Allocation → Step4Summary, orchestrated by `PortfolioWizard.tsx`.
- **State:** `src/hooks/useWizardState.ts` — central wizard state with localStorage persistence (`njord_portfolio_wizard` key, schema v1). Step validation, navigation, derived waterfall allocations.
- **Calculations:** `src/utils/accumulationCalculator.ts` — extended with `calcPortfolioResult`, `calcWeightedReturn`, `simulateSavingsBucket`, `buildAnnualTable`. Bridges wizard types → old calculator via weighted return conversion.
- **Types:** `src/types/portfolio.ts` — Broker, WizardState, ETF_PRESETS, PortfolioAllocation. `src/types/accumulation.ts` — BucketConfig, AccumulationResult, AnnualTableRow.
- **Validation:** `src/utils/allocationValidation.ts` — pure functions for slider math (sum to 100%, normalize, adjust).
- **Broker constraints:** XTB has `ikze: false` (disabled in IKZE); PKO BP only offers bonds instruments.
- **Waterfall allocation:** IKE fills first (up to limit) → IKZE next → surplus to regular wrapper.

### Persisted state schema
- `src/utils/persistedState.ts` — schema v4, key `njord_state`
- When adding new fields, bump `SCHEMA_VERSION` and add a migration in `loadState()`
- Tax transactions are NOT in the main persisted state — they live under `njord_tax_transactions`
- Portfolio wizard state is separate under `njord_portfolio_wizard` (managed by `useWizardState`)

---

## Extensibility notes

### Adding a new benchmark type (e.g., ETF)
1. Extend `BenchmarkType` in `src/types/scenario.ts`: `'savings' | 'bonds' | 'etf'`
2. Add a new calculation function in `src/utils/calculations.ts` (e.g., `calcETFEndValue`)
3. Extend `calcBenchmarkEndValue()` with the new branch
4. Add ETF-specific UI inputs in `src/components/InputPanel.tsx` (expense ratio, etc.)
5. Add third button in benchmark selector (`InputPanel.tsx`, search for the existing `savings`/`bonds` button group)
6. Handle new state variables in `App.tsx`
7. Layout (2-col grid) does not need changes — it accommodates new benchmark types well

### Preparing for dark theme
- **Current state:** 120+ hardcoded Tailwind color classes across all components
- **index.css** has semantic tokens in `@theme {}` — add new semantic variables here
- **Migration path:** Replace hardcoded classes with CSS variable references. Start with major surfaces (App.tsx header/footer, card backgrounds), then progressively migrate smaller components.
- Chart colors in Recharts components need to become dynamic props instead of hardcoded hex values.

### Adding investment metrics/indicators
- Current model: 3 scenarios (Bear/Base/Bull) with deltaStock + deltaFx — simple but flexible
- To add metrics like Sharpe ratio, max drawdown, VaR, Sortino:
  - Extend `useHistoricalVolatility` hook to compute additional statistics
  - Add new display section in UI (below ScenarioEditor or as separate component)
  - Keep calculations in pure functions within `utils/`

---

## Future planned features

- **ETFs as benchmark** — third option alongside savings and bonds (useEtfData hook already exists)
- **Dark theme** — light/dark toggle; `useDarkMode` hook exists, CSS tokens partially defined in `index.css`; full component migration still needed
- **Multiple investment indicators** — Sharpe ratio, max drawdown, VaR, Sortino from historical data
- **Dividend support** — incorporate stock dividend yields into return calculations
- **Tax calculator: export** — CSV/PDF export of PIT-38 summary
- **Tax calculator: FIFO** — automatic cost-basis calculation for partial sells of the same ticker

## Notes for AI agents

- **Three tabs:** `activeSection === 'investment'` (default) shows the investment comparison; `activeSection === 'tax'` shows the Belka tax calculator; `activeSection === 'portfolio'` shows the Kreator portfela wizard. KantorSidebar is hidden on the tax and portfolio tabs.
- **Prediction engine:** Tiered — Block Bootstrap (≤6 months), calibrated GBM (>6 months). Drift shrunk toward 8% prior; volatility damped for horizons >2 years. All outputs clamped via `clampScenario()`. See `.github/instructions/financial-forecasting.instructions.md` for full details.
- **HMM** (`src/utils/hmm.ts`) is used by the **Sell Analysis feature only** — it does NOT drive the bear/base/bull scenario pipeline. The scenario pipeline uses GBM + Bootstrap exclusively.
- **Sell Analysis Worker:** `src/workers/sellAnalysis.worker.ts` is a **Web Worker** (browser API), not a Cloudflare Worker. It offloads HMM Monte Carlo simulation (10k paths) to a background thread so the UI stays responsive.
- **Belka tax calculator:** Multi-transaction, supports USD/EUR/GBP/CHF/DKK/SEK/PLN. Fetches NBP Table A mid rate automatically for each transaction date. Transactions persisted to `localStorage` under `njord_tax_transactions`. Groups results by tax year for PIT-38. Commission fields hidden by default (checkbox). See `src/components/TaxCalculatorPanel.tsx` and `src/utils/taxCalculator.ts`.
- **Financial math:** Belka tax, bond math, FX multiplicative structure, compound interest rules — see `.github/instructions/financial-math-guardian.instructions.md`.
- **Hooks and state:** AbortController patterns, localStorage guards, App.tsx state architecture — see `.github/instructions/hooks-and-state.instructions.md`.
- **Backend (Pages Functions):** API key secrecy, CF constraints, caching strategy — see `.github/instructions/backend-api.instructions.md`.
- Historical volatility scenarios are auto-applied on first data load (via `useEffect` + `scenariosAutoApplied` ref in `App.tsx`). The "Przywróć z historii" button restores them after manual edits.
- Inflation impact is shown as real returns (Fisher formula) alongside nominal values. The orange warning banner appears only when `inflationRate > 0`.
- The purchasing power line on the timeline chart is a dashed orange line showing value erosion from inflation.
- `wibor3m` state variable in `App.tsx` represents the savings account interest rate (not the raw WIBOR 3M index). Help text in the UI clarifies this.
- All financial calculations are pure functions — easy to unit test.
- **State persistence:** `persistedState.ts` — schema v4. Migrations: v1→v2 adds `activeSection`, v2→v3 adds `bondSettings.maturityMonths` + `isRSU`, v3→v4 renames `activeSection` `'accumulation'`→`'portfolio'`. Always bump version and add migration when adding new persisted fields.
- **Portfolio wizard** (`src/components/portfolio/`): 4-step wizard with separate localStorage (`njord_portfolio_wizard`). Uses `useWizardState` hook. Reuses `AccumulationChart` and `accumulationCalculator.ts`. KantorSidebar is hidden on the portfolio tab.

### Validation loop

After modifying any file in `src/utils/`, `src/hooks/`, or `functions/`:
1. Run `npm test` — all tests must pass
2. Run `npm run lint` — zero errors
3. Run `npm run build` — must compile cleanly

For type-checking only (faster): `npx tsc --noEmit`

After modifying any file in `src/components/`:
1. Run `npm run lint && npm test && npm run build`
2. Start dev server (`npm run dev`) and visually verify the component renders correctly
3. Check layout at mobile (375px) and desktop (1280px) widths

The CI pipeline (`.github/workflows/build-and-test.action.yaml`) enforces lint + test + build automatically on every push and pull request.
The Copilot cloud coding agent environment is configured via `.github/copilot-setup-steps.yml`.
