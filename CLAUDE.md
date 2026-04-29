# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Njord** — Polish-language SPA for comparing USD stock portfolios against Polish savings instruments (savings accounts, government bonds). Educational tool only. Hosted on Cloudflare Pages with a thin Pages Functions backend.

## Commands

```bash
npm run dev              # Frontend only (Vite) → localhost:5173
npm run dev:full         # Full stack: Vite + Pages Functions → localhost:8788
npm run build            # tsc -b && vite build → dist/
npm run lint             # ESLint (zero-error enforced)

npm test                 # Vitest unit tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Coverage report (targets src/utils/**)
npm run test:backtest    # tsx src/scripts/backtest.ts
npm run test:e2e         # Playwright (requires running preview server)
npm run test:e2e:ui      # Playwright with UI
```

Local full-stack dev requires `.dev.vars` with `JWT_SECRET`, OAuth secrets, and optionally `TWELVE_DATA_API_KEY`.

## Architecture

All financial computation runs **client-side**. The backend (`functions/api/`) is a thin proxy layer only.

```
App.tsx (root — all state lives here, no global store)
├── components/          React UI components; props-drilled from App.tsx
│   └── portfolio/       4-step portfolio wizard
├── hooks/               Data fetching (useAssetData, useFxData, useAuth, etc.)
├── utils/               Pure calculation functions
│   └── models/          GBM, Bootstrap, HMM prediction models
├── providers/           twelveDataProvider, nbpProvider (Yahoo Finance fallback)
├── workers/             Web Worker for HMM Monte Carlo (sellAnalysis.worker.ts)
└── types/               TypeScript interfaces

functions/api/
├── analyze.ts           Yahoo Finance → stocks + FX (1h cache)
├── bonds.ts             Bond presets CSV (24h cache)
├── currency-rates.ts    Alior Kantor + NBP Table C (real-time)
├── inflation.ts         ECB HICP CPI (24h cache)
└── auth/                JWT + OAuth (GitHub, Google)
```

**Prediction model selection:** ≤6 months → Block Bootstrap; >6 months → Calibrated GBM; HMM only for sell analysis.

## Rules

- **UI text:** Polish. **Code, commits, docs:** English.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **State:** All state in `App.tsx`, passed via props. No global store.
- **React 19:** Use `use()` instead of `useContext()`. Pass `ref` as regular prop — no `forwardRef`.
- **Styling:** Tailwind CSS v4 utility classes only. Semantic color tokens defined in `src/index.css` via `@theme`. Never hardcode hex values.
- **Infrastructure:** Terraform in `/infrastructure/` manages Cloudflare Pages + D1 database (SQLite).
- **Node:** ≥22 required.
