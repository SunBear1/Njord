<!-- icm:start -->
## Persistent memory (ICM) — MANDATORY

This project uses [ICM](https://github.com/rtk-ai/icm) for persistent memory across sessions.
You MUST use it actively. Not optional.

### Recall (before starting work)
```bash
icm recall "query"                        # search memories
icm recall "query" -t "topic-name"        # filter by topic
icm recall-context "query" --limit 5      # formatted for prompt injection
```

### Store — MANDATORY triggers
You MUST call `icm store` when ANY of the following happens:
1. **Error resolved** → `icm store -t errors-resolved -c "description" -i high -k "keyword1,keyword2"`
2. **Architecture/design decision** → `icm store -t decisions-{project} -c "description" -i high`
3. **User preference discovered** → `icm store -t preferences -c "description" -i critical`
4. **Significant task completed** → `icm store -t context-{project} -c "summary of work done" -i high`
5. **Conversation exceeds ~20 tool calls without a store** → store a progress summary

Do this BEFORE responding to the user. Not after. Not later. Immediately.

Do NOT store: trivial details, info already in CLAUDE.md, ephemeral state (build logs, git status).

### Other commands
```bash
icm update <id> -c "updated content"     # edit memory in-place
icm health                                # topic hygiene audit
icm topics                                # list all topics
```
<!-- icm:end -->

# Njord

Polish-language investment calculator SPA. Compares USD stock/ETF portfolios against Polish savings instruments (savings accounts, 8 bond types, ETFs). All financial computation client-side.

- **Routes:** `/` `/comparison` `/forecast` `/tax` `/portfolio` `/rates`
- **UI language:** Polish | **Code/commits/docs:** English

## Platform

- **Runtime:** Node 22 LTS | **Package manager:** npm (never yarn/pnpm)
- **Framework:** React 19 + Vite 6 | **Language:** TypeScript strict
- **Styling:** Tailwind CSS v4 (utility classes only, semantic tokens via `@theme`)
- **Browser targets:** last 2 versions Chrome, Firefox, Safari
- **CI:** GitHub Actions (Ubuntu latest)
- **Deploy target:** self-hosted k3s/k3d cluster + Go backend + Postgres. See `_bmad-output/planning-artifacts/architecture.md`. (Under active reconsideration — see `decisions-architecture-njord` in ICM: reverting to Cloudflare Pages + Workers + D1.)

## Architecture

```
frontend/pages/         Page components (own their state, pass via props)
frontend/components/    UI (receives props, never fetches data)
frontend/hooks/         Data fetching + state management
frontend/utils/         Pure calculation functions (ZERO side effects)
frontend/utils/models/  GBM, Bootstrap, HMM prediction models
frontend/providers/     API adapters (Yahoo Finance, NBP)
frontend/workers/       Web Worker for HMM Monte Carlo
frontend/types/         TypeScript interfaces

backend/               Go backend (api server, served from k3s)
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

No exceptions. Fix failures before proceeding. Context-specific checks in nested `CLAUDE.md` files per domain (see Path-Specific Instructions below).

## Security

- `.dev.vars` is `.gitignore`d — never stage it.
- API keys, DB passwords, JWT signing keys — never in code or chat responses. Kubernetes Secrets / sealed-secrets.
- If a command is destructive (`rm -rf`, `DROP`, force push, `kubectl delete namespace`) — warn before executing.

## Delivering Work

1. Feature branch: `<type>/<scope>` (general) or `<type>/epic-<E>-story-<E>-<S>-<slug>` (BMAD stories).
2. Conventional Commits message.
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

Domain rules live in nested `CLAUDE.md` files and load automatically when working in that directory tree:

- `frontend/components/CLAUDE.md`, `frontend/pages/CLAUDE.md` — component/page conventions, Tailwind, accessibility
- `frontend/hooks/CLAUDE.md`, `frontend/providers/CLAUDE.md` — state management, data fetching patterns
- `frontend/utils/CLAUDE.md`, `frontend/workers/CLAUDE.md` — financial math, tax law, prediction models
- `frontend/tokens/CLAUDE.md` — design token architecture
- `frontend/__tests__/CLAUDE.md` — test patterns
- `infrastructure/helm/CLAUDE.md` — Helm chart conventions
- `infrastructure/CLAUDE.md` — Kubernetes/ArgoCD manifests, bash scripting rules
