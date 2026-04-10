# Copilot Instructions — Njord

Polish-language financial comparison SPA: USD stock portfolio vs Polish savings accounts and government bonds. Hosted on Cloudflare Pages with a thin Pages Function backend for API key secrecy.

## Commands

```bash
npm run dev          # Frontend only → http://localhost:5173/
npm run dev:full     # Full stack (Vite + Pages Functions) → http://localhost:8788/
npm run build        # tsc -b && vite build
npm run lint         # ESLint (zero-error enforced)
npm test             # Vitest — all tests
npm run test:watch   # Vitest — watch mode
npx vitest run src/__tests__/gbmModel.test.ts  # Single test file
```

Local Pages Functions require `.dev.vars` with `TWELVE_DATA_API_KEY=...`.

## Architecture

**All state lives in `App.tsx`** — passed via props, no global store. No routing (single page).

**Data flow:**
1. `useAssetData` → calls `/api/analyze` Pages Function → Twelve Data (stock prices) + NBP (FX history)
2. `useFxData` → direct NBP call for live USD/PLN sell rate
3. `useHistoricalVolatility` → runs prediction models client-side (GBM or Bootstrap depending on horizon)
4. `App.tsx` → passes scenarios + asset data to calculation functions → distributes results to chart/display components

**Backend** (`functions/api/analyze.ts`): Thin proxy that fetches stock data with a server-side API key and caches at the CF edge for 1 hour. All financial computation runs in the browser.

**Prediction engine** (tiered):
- ≤6 months: Block Bootstrap (empirical, no parametric assumptions)
- \>6 months: Calibrated GBM with drift shrinkage toward 8% equity prior and damped volatility for long horizons
- All outputs clamped via `clampScenario()` — see `src/utils/models/gbmModel.ts`
- HMM regime detection is informational only (confidence capped at 0.25)

**Financial calculations** (`src/utils/calculations.ts`): Pure functions — `calcAllScenarios`, `calcTimeline`, `calcHeatmap`. Polish 19% Belka tax applied to all profit. Bond logic handles 8 preset types with fixed/reference/inflation rate types.

## Conventions

- **UI text: Polish.** Everything else (code, commits, docs, comments): English.
- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **Styling:** Tailwind CSS v4 utility classes only. Semantic color tokens defined in `src/index.css` via `@theme` — use existing tokens, add new ones there when needed. Never hardcode hex in components.
- **Components:** Functional with hooks. Props typed via interfaces. No class components.
- **React 19:** Use `use()` instead of `useContext()`. Pass `ref` as a regular prop (no `forwardRef`).
- **Charts:** Recharts library with consistent color palette from CSS variables.
- **Icons:** Lucide React.
