# Njord

Polish-language investment calculator SPA. Compares USD stock/ETF portfolios against Polish savings instruments (savings accounts, 8 bond types, ETFs). All financial computation client-side.

- **Live:** https://njord.pages.dev
- **Routes:** `/` `/comparison` `/forecast` `/tax` `/portfolio` `/rates`
- **UI language:** Polish | **Code/commits/docs:** English

## Platform

- **Runtime:** Node 22 LTS | **Package manager:** npm (never yarn/pnpm)
- **Framework:** React 19 + Vite 6 | **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4 (utility classes only, semantic tokens via `@theme`)
- **Deploy:** Cloudflare Pages — V8 isolates (NOT Node.js; no `fs`, `path`, `process`)
- **Browser targets:** last 2 versions Chrome, Firefox, Safari
- **CI:** GitHub Actions (Ubuntu latest)
- **Shell:** fish (default shell on localhost machine)

## Architecture

```
src/pages/         Page components (own their state, pass via props)
src/components/    UI (receives props, never fetches data)
src/hooks/         Data fetching + state management
src/utils/         Pure calculation functions (ZERO side effects)
src/utils/models/  GBM, Bootstrap, HMM prediction models
src/providers/     API adapters (Yahoo Finance, NBP)
src/workers/       Web Worker for HMM Monte Carlo (browser, NOT CF Worker)
src/types/         TypeScript interfaces

functions/api/     CF Pages Functions (thin proxy/cache layer)
infrastructure/    Terraform (CF Pages + D1)
```

No global state. Pages own state -> pass via props. `Layout.tsx` owns shared concerns only.

## Response Format

- Be terse. Minimal diffs. Changed lines only unless full context is needed.
- One best answer — no alternatives unless asked.
- No preamble, no restating the question, no summaries of what you did.
- If the answer is one command, give one command.
- Use plan mode for multi-file changes.

## Critical Invariants

1. **Belka tax = 19% on PROFIT only** — never on principal.
2. **FX x stock deltas are multiplicative** — `(1+dS) * (1+dFX)`, never additive.
3. **NBP rate = last business day BEFORE transaction** — never the transaction date itself.
4. **No global state** — no Redux, Zustand, Jotai, Context stores. Pages own state.
5. **Pure financial functions** — no `fetch`, `localStorage`, or DOM in `src/utils/`.
6. **UI in Polish, code in English** — no mixing.
7. **Tailwind tokens only** — no hardcoded hex, no CSS modules, no `@apply`.
8. **All checks pass before commit** — `npx tsc --noEmit && npm run lint && npm test && npm run build`.
9. **No secrets in code** — never commit `.dev.vars`, API keys, or tokens.

## Conventions

- **Commits:** Conventional Commits — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- **React 19:** `use()` not `useContext()`. `ref` as prop, no `forwardRef`.
- **Components:** Functional + hooks. Props typed via named interfaces.
- **Charts:** Recharts with colors from CSS variables. **Icons:** Lucide React.
- **Prediction engine:** <=6 months -> Block Bootstrap; >6 months -> Calibrated GBM.

## Code Quality

Always enforced across all code changes:

- **File limits:** Components <300 lines, utils <200, hooks <150
- **No catch-all files:** Never create `utils/helpers.ts`, `common/index.ts`, or similar dumping grounds
- **No premature abstractions:** No factories, DI containers, or interfaces with only 1 implementation
- **Naming:** Domain-specific (`belkaTax`, `nbpRate`, `deltaStock`) — never generic (`data`, `info`, `item`, `result`, `value`)
- **Code:** No `console.log` (only `console.error` for genuine errors), no commented-out code, no `TODO` without issue reference
- **Imports:** Every import must be used; no dead code

## Validation

Critical validation before commiting changes:

```bash
npx tsc --noEmit --skipLibCheck -p functions/tsconfig.json && npm run lint && npm test && npm run build && npx playwright test
```

No exceptions. Fix failures before proceeding. Context-specific checks in `.github/instructions/` files per domain.

## Delivering Work

1. Feature branch: `<type>/<short-description>` (e.g. `feat/bond-calculator`).
2. Conventional Commits message.
3. Push + `gh pr create --base main`.
4. Present PR URL as the final step.

Never commit directly to `main`.

## Security

- `.dev.vars` is `.gitignore`d — never stage it.
- API keys live in CF Pages secrets, never in code or responses.
- If a command is destructive (`rm -rf`, `DROP`, force push) — warn before executing.

## Dependencies

Before adding any npm package:
1. Can I write it in <50 lines of TS? -> Write it.
2. Is it a polyfill for something in Node 22 / modern browsers? -> Do not add.
3. Does it pull >100KB into the bundle? -> Find a lighter alternative.
4. Maintained (updated in last 6 months)? -> Acceptable.

## Path-Specific Instructions

Detailed rules for specific file types live in `.github/instructions/`:
- `react-components.instructions.md` — Component design, Tailwind, accessibility
- `hooks-state-providers.instructions.md` — State management, data fetching, providers
- `financial-calculations.instructions.md` — Tax, bond math, prediction models
- `testing.instructions.md` — Test patterns, Playwright, edge cases
- `backend-api.instructions.md` — Cloudflare Pages Functions, caching, CORS
- `styling-tokens.instructions.md` — Design tokens, theming, dark mode
- `infrastructure.instructions.md` — Terraform, GitHub Actions
