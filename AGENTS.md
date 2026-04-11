# AGENTS.md — Njord

Instructions for AI agents working with this repository.

## Project overview

**Njord** is a React/TypeScript SPA (Single Page Application) that compares holding a USD-denominated stock portfolio against Polish savings instruments: savings accounts or government bonds (obligacje skarbowe). All computations run in the browser — no backend.

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

Local dev with Pages Functions (requires `.dev.vars`):
```ini
TWELVE_DATA_API_KEY=your_key
```

---

## File structure

```
src/
├── App.tsx                       # Root component, all app state lives here
├── components/
│   ├── InputPanel.tsx            # Left panel: ticker, shares, FX, benchmark selector, horizon slider
│   ├── ScenarioEditor.tsx        # 3-scenario editor (bear/base/bull) + historical volatility suggestions
│   ├── VerdictBanner.tsx         # Results summary (which scenarios beat the benchmark)
│   ├── ComparisonChart.tsx       # Bar chart: stocks vs benchmark end value
│   ├── TimelineChart.tsx         # Line chart: portfolio value over time
│   ├── BreakevenChart.tsx        # Heatmap: stock delta × FX delta — where stocks beat benchmark
│   ├── MethodologyPanel.tsx      # Calculation methodology explanation
│   └── HowItWorks.tsx           # User guide / how-to
├── hooks/
│   ├── useAssetData.ts           # Fetch stock + analysis data from /api/analyze
│   ├── useFxData.ts              # PLN/USD rate from NBP API (auto-refresh for current rate)
│   ├── useCpiGus.ts              # CPI inflation from GUS BDL API (auto-fetch on mount)
│   └── useHistoricalVolatility.ts # Accepts precomputed scenarios from Worker; local recompute on horizon change
├── providers/
│   ├── twelveDataProvider.ts     # Calls /api/analyze (Cloudflare Pages Function)
│   └── nbpProvider.ts            # NBP USD/PLN exchange rate fetch (direct, for current rate refresh)
├── utils/
│   ├── calculations.ts           # All financial logic (pure functions)
│   ├── assetConfig.ts            # Constants (DEFAULT_HORIZON_MONTHS = 12)
│   └── formatting.ts             # Number formatting (fmtUSD, fmtPLN, fmtNum)
├── types/
│   ├── scenario.ts               # ScenarioKey, BenchmarkType, BondPreset, ScenarioResult
│   ├── asset.ts                  # AssetData, HistoricalPrice
│   └── analyze.ts                # AnalyzeResponse, AnalyzeResult (Worker response types)
functions/
└── api/
    └── analyze.ts                # Pages Function: GET /api/analyze?ticker=X&horizonMonths=N
                                  # Fetches Twelve Data (secret key) + NBP FX; scenario models run client-side
```

---

## External APIs

| API | URL | Purpose | CORS | Auth |
|-----|-----|---------|------|------|
| Twelve Data | `api.twelvedata.com/time_series` | Stock prices, 252 sessions | Yes | API key required (server-side secret) |
| NBP | `api.nbp.pl/api/exchangerates/...` | USD/PLN rate | Yes | None |
| ECB HICP | `data-api.ecb.europa.eu/service/data/ICP/...` | Polish CPI inflation | Yes | None |

**Twelve Data free tier:** 800 req/day, 8/min. API key stored as Cloudflare Pages environment secret (`TWELVE_DATA_API_KEY`) — never exposed to the browser. The `/api/analyze` Pages Function reads it server-side.

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

8 presets defined in `src/data/bondPresets.ts` (constant `BOND_PRESETS`):

| ID | Name | Maturity | Rate type | Year 1 | Margin |
|----|------|----------|-----------|--------|--------|
| OTS | 3-month | 3 mo | fixed | 1.50% | 0 |
| ROR | Annual | 12 mo | reference (NBP) | 5.50% | 0 |
| DOR | 2-year | 24 mo | reference (NBP) | 5.60% | 0.25% |
| TOS | 3-year | 36 mo | fixed | 5.70% | 0 |
| COI | 4-year | 48 mo | inflation | 6.00% | 1.50% |
| EDO | 10-year | 120 mo | inflation | 6.20% | 2.00% |
| ROS | 6-year (family) | 72 mo | inflation | 6.05% | 2.00% |
| ROD | 12-year (family) | 144 mo | inflation | 6.45% | 2.50% |

> Rates as of 2025-07-17. Source: https://www.obligacjeskarbowe.pl/oferta-obligacji/

`BondRateType`: `fixed` | `reference` | `inflation`

Effective rate for years 2+:
- `fixed` → `bondFirstYearRate` (unchanged)
- `reference` → `nbpRefRate + margin`
- `inflation` → `inflationRate + margin`

---

## App state (App.tsx)

All state lives in `App.tsx` and is passed to components via props. No global store (Redux/Zustand). Key state:

| State | Type | Description |
|-------|------|-------------|
| `horizonMonths` | `number` | 1–144, default 12; max 60 for savings mode |
| `benchmarkType` | `BenchmarkType` | `'savings'` or `'bonds'` |
| `scenarios` | `Scenarios` | bear/base/bull: deltaStock + deltaFx in % |
| `wibor3m` | `number` | Savings account interest rate, % annual |
| `bondFirstYearRate` | `number` | Bond year-1 rate in % |
| `bondPenalty` | `number` | Early redemption penalty, % of principal |
| `inflationRate` | `number` | CPI inflation, % annual (auto-fetched from GUS) |
| `nbpRefRate` | `number` | NBP reference rate in % |

---

## Conventions

- **UI language:** Polish (labels, error messages, descriptions) — this is the ONLY place Polish is used
- **Code language:** English (variable names, function names, comments, type names)
- **Commit messages:** English, following [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- **Documentation:** English (README.md, AGENTS.md, code comments, JSDoc)
- **Styling:** Tailwind CSS v4 only (utility classes); no CSS modules or styled-components. Semantic color tokens are defined in `src/index.css` via `@theme` — use them when available, add new ones when needed.
- **Components:** Functional with hooks; no classes; props explicitly typed via interfaces
- **No routing** — single-page application
- **Testing:** Vitest (`npm test` / `npm run test:watch`). Tests in `src/__tests__/`.
- **Deploy:** Automatic on `main` push via **Cloudflare Pages** native GitHub integration (no GH Actions workflow)
- **Backend:** `functions/api/analyze.ts` — Cloudflare Pages Function at `GET /api/analyze?ticker=X&horizonMonths=N`. Fetches Twelve Data (server-side API key) + NBP FX data; returns `ProxyResponse`. All scenario computation (GBM, Bootstrap) runs client-side.
- **Base path:** `/` (Cloudflare Pages serves from root)
- **Agent docs:** `AGENTS.md` at repo root — this is the standard location for GitHub Copilot and other AI agents. For monorepo subprojects, nested `AGENTS.md` files can be placed in subdirectories.

---

## Common tasks

### Adding a new bond type
1. Add object to `BOND_PRESETS` array in `src/data/bondPresets.ts`
2. Ensure `rateType` is one of `'fixed' | 'reference' | 'inflation'`
3. Verify `maturityMonths <= 144` (slider max for bonds mode)

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

- **ETFs as benchmark** — third option alongside savings and bonds
- **Dark theme** — light/dark toggle with localStorage persistence; CSS custom properties already extracted in `index.css`, commented-out dark values ready
- **Multiple investment indicators** — Sharpe ratio, max drawdown, VaR, Sortino from historical data
- **Dividend support** — incorporate stock dividend yields into return calculations

## Notes for AI agents

- **Prediction engine:** Tiered — Block Bootstrap (≤6 months), calibrated GBM (>6 months). Drift shrunk toward 8% prior; volatility damped for horizons >2 years. All outputs clamped via `clampScenario()`. See `.github/instructions/financial-forecasting.instructions.md` for full details.
- **HMM** (`src/utils/hmm.ts`) is used by the **Sell Analysis feature only** — it does NOT drive the bear/base/bull scenario pipeline. The scenario pipeline uses GBM + Bootstrap exclusively.
- **Financial math:** Belka tax, bond math, FX multiplicative structure, compound interest rules — see `.github/instructions/financial-math-guardian.instructions.md`.
- **Hooks and state:** AbortController patterns, localStorage guards, App.tsx state architecture — see `.github/instructions/hooks-and-state.instructions.md`.
- **Backend (Pages Functions):** API key secrecy, CF constraints, caching strategy — see `.github/instructions/backend-api.instructions.md`.
- Historical volatility scenarios are auto-applied on first data load (via `useEffect` + `scenariosAutoApplied` ref in `App.tsx`). The "Przywróć z historii" button restores them after manual edits.
- Inflation impact is shown as real returns (Fisher formula) alongside nominal values. The orange warning banner appears only when `inflationRate > 0`.
- The purchasing power line on the timeline chart is a dashed orange line showing value erosion from inflation.
- `wibor3m` state variable in `App.tsx` represents the savings account interest rate (not the raw WIBOR 3M index). Help text in the UI clarifies this.
- All financial calculations are pure functions in `calculations.ts` — easy to unit test.

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

The CI pipeline (`.github/workflows/ci.yml`) enforces lint + test + build automatically on every push and pull request.
The Copilot cloud coding agent environment is configured via `.github/copilot-setup-steps.yml`.
