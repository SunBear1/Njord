# CLAUDE.md

## Project

**Njord** — Polish-language investment calculator SPA comparing USD stock/ETF portfolios against Polish savings instruments (savings accounts, 8 types of government bonds, ETFs). All financial computation runs client-side. Hosted on Cloudflare Pages with thin Pages Functions backend.

- **Live:** https://njord.pages.dev
- **UI language:** Polish | **Code/commits/docs:** English
- **Base currency:** PLN (converted from USD via NBP)

## Commands

```bash
npm run dev          # Frontend only (Vite) → localhost:5173
npm run dev:full     # Full stack: Vite + Pages Functions → localhost:8788
npm run build        # tsc -b && vite build → dist/
npm run lint         # ESLint (zero-error enforced)
npm test             # Vitest unit tests (446+ tests)
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Playwright (requires preview server)
npx tsc --noEmit     # Type-check only (fast)
```

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

## Rules (detailed in `.claude/rules/`)

Read and follow ALL rules files. They are mandatory, not advisory.

| Rule File | Scope |
|-----------|-------|
| `ui-ux-design.md` | Visual design, layout, anti-slop UI patterns, accessibility |
| `color-palette.md` | Semantic tokens, chart colors, dark mode, contrast |
| `css-tailwind.md` | Tailwind v4 only, class ordering, responsive, forbidden CSS |
| `react-development.md` | React 19 conventions, hooks, state, components, performance |
| `efficiency-performance.md` | Computation budgets, memory, network, bundle, workers |
| `validation-loops.md` | Mandatory test/lint/build sequences, quality gates |
| `financial-correctness.md` | Tax law, bond math, FX, rounding — HARD constraints |
| `financial-methodology.md` | GBM, Bootstrap, HMM model specs, clamping, data quality |
| `anti-slop-quality.md` | Code smell detection, naming, comments, git hygiene |

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
