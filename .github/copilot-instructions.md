# RTK — Token-Optimized CLI

**rtk** is a CLI proxy that filters and compresses command outputs, saving 60-90% tokens.

## Rule

Always prefix shell commands with `rtk`:

```bash
# Instead of:              Use:
git status                 rtk git status
git log -10                rtk git log -10
cargo test                 rtk cargo test
docker ps                  rtk docker ps
kubectl get pods           rtk kubectl get pods
```

## Meta commands (use directly)

```bash
rtk gain              # Token savings dashboard
rtk gain --history    # Per-command savings history
rtk discover          # Find missed rtk opportunities
rtk proxy <cmd>       # Run raw (no filtering) but track usage
```

# Njord

Polish-language investment calculator SPA. Compares USD stock/ETF portfolios against Polish savings instruments (savings accounts, 8 bond types, ETFs). All financial computation client-side.

- **Live:** https://njord.pages.dev
- **Routes:** `/` `/comparison` `/forecast` `/tax` `/portfolio` `/rates`
- **UI language:** Polish | **Code/commits/docs:** English

## Platform

- **Runtime:** Node 22 LTS | **Package manager:** npm (never yarn/pnpm)
- **Framework:** React 19 + Vite 6 | **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4 (utility classes only, semantic tokens via `@theme`)
- **Browser targets:** last 2 versions Chrome, Firefox, Safari
- **CI:** GitHub Actions (Ubuntu latest)
- **Deploy (current):** Cloudflare Pages — V8 isolates (NOT Node.js; no `fs`, `path`, `process`)
- **Deploy (Epic 0, in progress):** self-hosted k3s/k3d cluster + Go backend + Postgres. See `_bmad-output/planning-artifacts/architecture.md`.

## Architecture

> **Migration in progress (Epic 0):** moving from Cloudflare Pages + Functions to self-hosted k3s + Go backend. Both layouts coexist until Story 0.2 lands. Source of truth: `_bmad-output/planning-artifacts/architecture.md`.

```
frontend/pages/         Page components (own their state, pass via props)
frontend/components/    UI (receives props, never fetches data)
frontend/hooks/         Data fetching + state management
frontend/utils/         Pure calculation functions (ZERO side effects)
frontend/utils/models/  GBM, Bootstrap, HMM prediction models
frontend/providers/     API adapters (Yahoo Finance, NBP)
frontend/workers/       Web Worker for HMM Monte Carlo (browser, NOT CF Worker)
frontend/types/         TypeScript interfaces

functions/api/     CF Pages Functions — DEPRECATED (replaced by Go backend in Story 0.5+)
infrastructure/local/  k3d cluster bootstrap (Story 0.1)
infrastructure/helm/   Helm charts (Stories 0.3-0.5)
infrastructure/argocd/ ArgoCD Applications (Story 0.9)
_bmad-output/      BMAD planning + sprint tracking
```

No global state. Pages own state -> pass via props. `Layout.tsx` owns shared concerns only.

## Workflow (BMAD)

Project uses BMAD methodology. **Before starting any non-trivial work, read these:**

- `_bmad-output/planning-artifacts/epics.md` — all epics and stories (single source of truth for what to build)
- `_bmad-output/planning-artifacts/architecture.md` — binding architectural decisions (namespaces, naming, etc.)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — current status of every story (backlog / ready-for-dev / in-progress / review / done)
- `_bmad-output/implementation-artifacts/<epic>-<story>-*.md` — per-story dev context (BDD acceptance criteria, task breakdown)

When picking up work: read sprint-status.yaml → find first `ready-for-dev` story → load its context file → implement → update status as you progress.

## Response Format

- Be terse. Minimal diffs. Changed lines only unless full context is needed.
- One best answer — no alternatives unless asked.
- No preamble, no restating the question, no summaries of what you did.
- If the answer is one command, give one command.

## Critical Invariants

1. **Belka tax = 19% on PROFIT only** — never on principal.
2. **FX x stock deltas are multiplicative** — `(1+dS) * (1+dFX)`, never additive.
3. **NBP rate = last business day BEFORE transaction** — never the transaction date itself.
4. **No global state** — no Redux, Zustand, Jotai, Context stores. Pages own state.
5. **Pure financial functions** — no `fetch`, `localStorage`, or DOM in `frontend/utils/`.
6. **UI in Polish, code in English** — no mixing.
7. **Tailwind tokens only** — no hardcoded hex, no CSS modules, no `@apply`.
8. **All checks pass before commit** — see `## Validation` section below for the canonical command (single source of truth).
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

Critical validation before committing changes:

```bash
npx tsc --noEmit --skipLibCheck -p functions/tsconfig.json && npm run lint && npm test && npm run build && npx playwright test
```

Important: `npx playwright test` runs against `npm run preview` on `dist/`, so rebuild with `npm run build` after frontend changes before running Playwright.

No exceptions. Fix failures before proceeding. Context-specific checks in `.github/instructions/` files per domain.

## Security

- `.dev.vars` is `.gitignore`d — never stage it.
- API keys, DB passwords, JWT signing keys — never in code or chat responses. Today: CF Pages secrets. Post-Epic-0: Kubernetes Secrets / sealed-secrets.
- If a command is destructive (`rm -rf`, `DROP`, force push, `kubectl delete namespace`) — warn before executing.

## Delivering Work

1. Feature branch: `<type>/<scope>` (general) or `<type>/epic-<E>-story-<E>-<S>-<slug>` (BMAD stories).
2. Conventional Commits message, with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.
3. Push + `gh pr create --base main`.
4. Wait for CI, merge (`gh pr merge <N> --squash --delete-branch`), sync local main.
5. For BMAD stories: update `sprint-status.yaml` (ready-for-dev → review → done) in the same PR or a follow-up.

Never commit directly to `main`.

## Dependencies

Before adding any npm package:
1. Can I write it in <50 lines of TS? -> Write it.
2. Is it a polyfill for something in Node 22 / modern browsers? -> Do not add.
3. Does it pull >100KB into the bundle? -> Find a lighter alternative.
4. Maintained (updated in last 6 months)? -> Acceptable.

## Path-Specific Instructions

Domain rules live in `.github/instructions/*.instructions.md` and load automatically when matching files are touched (path-scoped via `applyTo` frontmatter). Do not list them here — the system surfaces the active set per-request.
