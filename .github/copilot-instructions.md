# Copilot Instructions — Njord

**Njord** — Polish-language investment calculator SPA comparing USD stock/ETF portfolios against Polish savings instruments (savings accounts, 8 types of government bonds, ETFs). All financial computation runs client-side. Hosted on Cloudflare Pages with thin Pages Functions backend.

- **Routes:** `/` (home), `/comparison`, `/forecast`, `/tax`, `/portfolio`, `/rates`
- **Live:** https://njord.pages.dev
- **UI language:** Polish | **Code/commits/docs:** English
- **Base currency:** PLN (converted from USD via NBP)

## Commands

```bash
npm run dev          # Frontend only → http://localhost:5173/
npm run dev:full     # Full stack (Vite + Pages Functions) → http://localhost:8788/
npm run build        # tsc -b && vite build
npm run lint         # ESLint (zero-error enforced)
npm test             # Vitest — all tests
npm run test:watch   # Vitest — watch mode
npm run test:e2e     # Playwright E2E (requires preview server)
npx tsc --noEmit     # Type-check only (fast)
npx vitest run src/__tests__/gbmModel.test.ts  # Single test file
```

Local Pages Functions work without any configuration (Yahoo Finance requires no key).
To enable the Twelve Data fallback, create `.dev.vars` with `TWELVE_DATA_API_KEY=...`.

## Architecture

```
src/
├── pages/              Route-level components (own their state)
├── components/         UI components (props from pages)
├── hooks/              Data fetching + state management
├── utils/              Pure calculation functions (ZERO side effects)
│   └── models/         GBM, Bootstrap, HMM prediction models
├── providers/          API adapters (Yahoo Finance, NBP)
├── workers/            Web Worker for HMM Monte Carlo (browser, NOT CF Worker)
└── types/              TypeScript interfaces

functions/api/          Cloudflare Pages Functions (thin proxy/cache)
infrastructure/         Terraform (CF Pages + D1)
```

**Each page component owns its state** — `Layout.tsx` owns shared concerns (dark mode, auth). react-router-dom v7 with BrowserRouter.

**Data flow:**
1. `useAssetData` → calls `/api/market-data` Pages Function → Yahoo Finance (primary) or Twelve Data (429 fallback) + NBP (FX history)
2. `useFxData` → direct NBP call for live USD/PLN sell rate
3. `useHistoricalVolatility` → runs prediction models client-side (GBM or Bootstrap depending on horizon)
4. Page components → pass scenarios + asset data to calculation functions → distribute results to chart/display components

**Backend** (`functions/api/market-data.ts`): Thin proxy — Yahoo Finance primary (no key), Twelve Data fallback on 429 (optional key). Caches at CF edge for 1 hour. All financial computation runs in the browser.

**Prediction engine:** ≤6 months → Block Bootstrap; >6 months → Calibrated GBM. HMM is used only by the Price Forecast feature — it does NOT drive bear/base/bull scenarios.

**Financial calculations** (`src/utils/calculations.ts`): Pure functions — `calcAllScenarios`, `calcTimeline`, `calcHeatmap`. Polish 19% Belka tax applied to all profit.

## Conventions

- **UI text: Polish.** Everything else (code, commits, docs, comments): English.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Styling:** Tailwind CSS v4 utility classes only. Semantic color tokens defined in `src/index.css` via `@theme` — use existing tokens, add new ones there when needed. Never hardcode hex in components.
- **Components:** Functional with hooks. Props typed via interfaces. No class components.
- **React 19:** Use `use()` instead of `useContext()`. Pass `ref` as a regular prop (no `forwardRef`).
- **Charts:** Recharts library with consistent color palette from CSS variables.
- **Icons:** Lucide React.

## Critical Invariants (never violate)

1. **Belka tax = 19% on PROFIT only** — never on principal.
2. **FX × stock deltas are multiplicative** — `(1+dS) × (1+dFX)`, never additive.
3. **NBP rate = last business day BEFORE transaction** — never the transaction date.
4. **No global state** — pages own state, pass via props.
5. **Pure financial functions** — no `fetch`, no `localStorage`, no DOM in `src/utils/`.
6. **UI in Polish, code in English** — no mixing.
7. **Tailwind tokens only** — no hardcoded colors, no CSS modules.
8. **All tests pass before commit** — `npm run lint && npm test && npm run build`.

## Validation (every change)

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

No exceptions. No skipping. Fix failures before proceeding.

## Delivering work

Every task — regardless of which agent performs it — is delivered as a pull request:

1. Do all work on a dedicated feature branch (never commit directly to `main`).
   - Branch name: `<type>/<short-description>` following Conventional Commits types (e.g. `feat/bond-calculator`, `fix/nbp-rate-lookup`, `ci/path-filters`).
2. Commit with a Conventional Commits message (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.).
3. Push the branch and open a PR targeting **`main`** with `gh pr create --base main`. Always target `main` — never another feature branch.
4. Present the PR URL to the user as the final step of every task.
