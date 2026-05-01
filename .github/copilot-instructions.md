# Copilot Instructions — Njord

Polish-language financial comparison SPA: USD stock portfolio vs Polish savings accounts and government bonds. Hosted on Cloudflare Pages with a thin Pages Function backend.

**Routes:** `/` (home), `/comparison`, `/forecast`, `/tax`, `/portfolio`, `/rates`

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
