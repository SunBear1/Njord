---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Njord - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Njord, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Źródło prawdy o portfelu:**
- FR1: Investor can create and maintain a consolidated portfolio view across supported manual and imported holdings sources.
- FR2: Investor can add, edit, and remove holdings manually.
- FR3: Investor can import portfolio or transaction data from supported external sources when integrations are available.
- FR4: Investor can use the product even when holdings data is provided manually rather than through broker integrations.
- FR5: Investor can reconcile duplicate, incomplete, conflicting, or incorrectly mapped portfolio data.
- FR6: Investor can distinguish confirmed, incomplete, estimated, and unverified portfolio data.
- FR7: Investor can review the provenance and freshness of portfolio-relevant data.
- FR8: Investor can see how data gaps or conflicts affect portfolio completeness and downstream recommendation quality.

**Ocena decyzji:**
- FR9: Investor can request a recommendation for how to allocate new cash or a new contribution.
- FR10: Investor can evaluate what to do with expiring cash products, such as a maturing deposit.
- FR11: Investor can compare at least two allocation options, including maintaining the status quo or deferring action.
- FR12: Investor can receive a primary recommended next action, a ranked set of alternatives, or a no-action outcome depending on available confidence.
- FR13: Investor can understand why the recommended next action is preferred over alternatives.
- FR14: Investor can adjust decision assumptions or inputs and see how the outcome changes.
- FR15: Investor can revisit the outcome of a prior decision session.

**Lokalny kontekst finansowy:**
- FR16: Investor can see projected outcomes adjusted for applicable taxes.
- FR17: Investor can see the impact of FX on compared options.
- FR18: Investor can compare global market instruments with relevant Polish alternatives.
- FR19: Investor can review tax, FX, and cost assumptions used in a comparison.
- FR20 [Phase 2]: Investor can generate a Belka tax summary for a given tax year.
- FR21: Investor can review the baseline, horizon, and net outcome attached to each scenario or alternative.

**Preferencje, dopasowanie i granice:**
- FR22: Investor can define decision preferences (horizon, liquidity, risk tolerance, account preferences).
- FR23: Investor can set constraints that exclude unsuitable options.
- FR24: Investor can see a visible scope disclaimer and limitations panel.
- FR25: Investor can see when a recommendation is outside supported scope.
- FR26 [Phase 2]: Investor can define a savings or allocation goal with amount and time horizon.
- FR27: Investor can override a recommendation and preserve that decision context.

**Wyjaśnialność, pewność i bramki decyzyjne:**
- FR28: Investor can see the confidence or uncertainty level attached to a recommendation.
- FR29: Investor can see the main factors that could change or reverse a recommendation.
- FR30: Investor can see when incomplete, stale, or conflicting data limits recommendation strength.
- FR31: Investor can receive a no-recommendation or conditional-recommendation outcome when information is insufficient.
- FR32: Investor can review the rationale, source data context, assumptions, and blockers behind a recommendation.
- FR33: Investor can distinguish between strong, conditional, and informational guidance.

**Monitoring, historia i dalsze kroki:**
- FR34 [Phase 2]: Investor can monitor changes that may invalidate a prior decision.
- FR35 [Phase 2]: Investor can receive alerts when a tracked threshold is crossed.
- FR36 [Phase 2]: Investor can review history of recommendations and recorded decisions.
- FR37 [Phase 2]: Investor can review historical scenarios and prior decision baselines.
- FR38 [Phase 3]: Investor can receive proactive next-best-action guidance on triggers.

**Wsparcie i bezpieczniki rekomendacji:**
- FR39: Operations users can review signals related to data quality and recommendation quality.
- FR40: Operations users can limit, flag, or suppress recommendations when reliability is in doubt.
- FR41: Support users can trace a recommendation back to its source data and assumptions.
- FR42: Support users can help investors correct incomplete or conflicting portfolio data.

### NonFunctional Requirements

- NFR-PERF-1: Main view ready in <= 2.5s p95.
- NFR-PERF-2: Recommendation after complete input in <= 3s p95.
- NFR-PERF-3: Loading state visible within <= 1s of action start.
- NFR-PERF-4: After 10s without defensible result → show delay/no-recommendation.
- NFR-SEC-1: Zero unauthorized data exposures.
- NFR-SEC-2: 100% of data changes auditable (who, when, scope, result).
- NFR-SEC-3: Data export/deletion request handled in <= 30 days.
- NFR-SEC-4: Zero unexplained data discrepancies in critical scenarios.
- NFR-SCALE-1: Meet all performance and zero critical errors at >= 60 active users.
- NFR-ACCESS-1: WCAG 2.2 AA for all key flows.
- NFR-ACCESS-2: Zero keyboard blockers in reference scenarios.
- NFR-ACCESS-3: Tables, warnings, degradation states accessible to assistive tech.
- NFR-INT-1: Full core flow possible in manual-first mode without broker integration.
- NFR-INT-2: Every external source shows source, freshness, completeness status.
- NFR-INT-3: Zero misleading recommendations from external source failure.
- NFR-INT-4: Missing critical input → no-recommendation or conditional with gap description.
- NFR-REL-1: Monthly availability >= 99.5% for core decision flow.
- NFR-REL-2: Partial failure → explicit state within <= 5s.
- NFR-REL-3: Zero false-confident recommendations on inconsistent/stale data.
- NFR-REL-4: Degradation mode shows: affected component, last reliable timestamp, impact, action recommendation.

### Additional Requirements

From Architecture:
- Recommendation engine as bounded context in `src/recommendation/` with linear pipeline (normalize → calculate → score → decide)
- Result<T, E> for all pipeline stage returns
- Backend facade API: POST /api/recommend → { verdict, confidence, trace[] }
- 4-component confidence model (data, model, assumption, stability)
- Verdict taxonomy: strong | conditional | none with mandatory DecisionTrace
- Runtime guard at recommendation/ boundary (assertValidSnapshot)
- Versioned config for thresholds (bond terms, tax rates, IKZE limits)
- Phase 1: engine on frontend (TS). Phase 2: migrate to Go backend (big bang)
- Full trace per pipeline stage, FE renders summary (progressive disclosure)
- Zero-portfolio / sparse input as first-class flow path

### UX Design Requirements

- UX-DR1: Implement "Verdict First Stack" pattern — primary recommendation/no-recommendation on top, evidence below, methodology at bottom (progressive disclosure).
- UX-DR2: Build Trust Panel component showing data sources, freshness timestamps, confidence level, assumptions, and scope limitations for each recommendation.
- UX-DR3: Implement Readiness Gate UI — visual checklist of minimum inputs needed before engine can produce recommendation, with clear "what's missing" state.
- UX-DR4: Build Comparison Module — side-by-side view of allocation options with net-after-tax, FX impact, risk, and switch cost per candidate.
- UX-DR5: Implement confidence visualization (4-component breakdown: data, model, assumption, stability) with overall confidence indicator.
- UX-DR6: Design and implement no-recommendation state as first-class UX — not error, not empty state, but specific "cannot recommend" with reason and next steps.
- UX-DR7: Build portfolio input flow — manual-first, lightweight, with data quality indicators (confirmed/incomplete/estimated/unverified per holding).
- UX-DR8: Implement assumption adjustment UI — user can tweak inputs (horizon, risk, FX assumption) and see recommendation update.
- UX-DR9: Design responsive layout — mobile for quick check-in and capture, desktop for deep comparison and assumption editing.
- UX-DR10: Implement dark mode preparation via CSS custom properties and semantic design tokens.
- UX-DR11: Build trace/explanation view — progressive disclosure from summary to full pipeline trace per stage.
- UX-DR12: Implement loading/uncertainty states — skeleton screens, partial data indicators, explicit "calculating" vs "waiting for data" distinction.

### FR Coverage Map

| FR | Epic | Opis |
|----|------|------|
| FR1-8 | Epic 1 | Portfolio Foundation |
| FR9-13 | Epic 2 | Decision Engine core |
| FR16-19, FR21 | Epic 2 | Lokalny kontekst (tax, FX, comparison) |
| FR24-25 | Epic 2 | Scope disclaimers |
| FR28, FR30-31, FR33 | Epic 2 | Minimal trust (confidence, no-rec, guidance types) |
| FR14-15 | Epic 3 | Assumption adjustment, session revisit |
| FR22-23, FR27 | Epic 3 | Preferences, constraints, override |
| FR29, FR32 | Epic 4 | Reversal factors, full rationale |
| FR39-42 | Epic 5 | Ops trace, data correction, safety |
| FR20, FR26 | Phase 2 | Belka PIT, goal-based |
| FR34-37 | Phase 2 | Monitoring, alerts, history |
| FR38 | Phase 3 | Proactive next-best-action |

### Cross-cutting

- UX-DR9 (responsive): every epic
- UX-DR10 (dark mode prep): post-MVP

### Implementation Notes

- Epic 2 pipeline MUSI produkować TraceEntry[] od dnia 1 (architektura wymaga). UI trace renderuje się w Epic 4, ale dane trace = Epic 2.
- Epic 4 jest opcjonalny w MVP (nice-to-have stretch). Core MVP = Epic 1+2+3.
- Zero-portfolio / sparse input = first-class flow w Epic 2 (explicit story required).

## Epic List

### Epic 0: Local-First Infrastructure & Backend Migration
Buduje self-hosted infrastrukturę na lokalnym 2-node k3d klastrze symulującym docelowy OCI setup. Refactor `src/`→`frontend/`, scaffold Go backendu, port wszystkich API z Cloudflare Pages Functions, instalacja ArgoCD z GitOps deployment, Helm charts dla 4 serwisów (frontend, backend, postgres, ingress). Big bang cutover bez okresu deprekacji (zero klientów). Cel: w pełni działający Njord lokalnie z prawdziwymi danymi (Yahoo Finance free tier, NBP, Alior, ECB) zanim wydamy cent na chmurę.

**FRs:** N/A (infrastructure foundation)
**NFRs:** NFR1 (perf), NFR3 (deploy), NFR5 (observability), NFR6 (security)
**Arch:** Go backend (kontynuacja `GO_BACKEND_PLAN.md`), Postgres single-replica StatefulSet, Helm charts w `infrastructure/charts/`, ArgoCD app-of-apps w `infrastructure/argocd/`, Traefik ingress (local) z planem zamiany na Cloudflare Tunnel (cloud phase)
**Cleanup:** Usuń Twelve Data referencje (dead code), usuń `functions/` po pomyślnym porcie
**Dependencies:** None (blocker dla wszystkich pozostałych epików)
**Note:** Faza cloud (Terraform OCI, CF Tunnel, CF Access SSO, domena, big bang DNS) wydzielona do osobnego Epic 99 — uruchamiana DOPIERO po ukończeniu Epic 0 i potwierdzeniu działającego MVP.

### Epic 1: Portfolio Foundation
User może stworzyć, edytować i utrzymywać skonsolidowany obraz portfela z widocznym statusem jakości danych, nawet w trybie manual-first bez integracji z brokerem.

**FRs:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8
**UX:** UX-DR7 (portfolio input flow), UX-DR12 (loading/uncertainty states)
**Cross-cutting:** UX-DR9 (responsive)
**Dependencies:** None (standalone)

### Epic 2: Decision Engine + Minimal Trust
User może poprosić o rekomendację alokacji nowej gotówki, zobaczyć werdykt (strong/conditional/none) z confidence level i top 3 czynnikami, porównać opcje po podatku i FX, zrozumieć dlaczego ta opcja prowadzi. Scope disclaimers widoczne od dnia 1. Zero-portfolio path = first-class flow.

**FRs:** FR9, FR10, FR11, FR12, FR13, FR16, FR17, FR18, FR19, FR21, FR24, FR25, FR28, FR30, FR31, FR33
**UX:** UX-DR1 (Verdict First Stack), UX-DR4 (Comparison Module), UX-DR5 (confidence viz), UX-DR6 (no-recommendation state)
**Arch:** Full src/recommendation/ pipeline (guard → normalize → calculate → score → decide), Result<T,E>, TraceEntry[] output
**Cross-cutting:** UX-DR9 (responsive)
**Dependencies:** Epic 1 (needs portfolio snapshot)

### Epic 3: Preferences, Adjustments & Session
User może zdefiniować preferencje decyzyjne (horyzont, płynność, tolerancja ryzyka), wykluczyć nieodpowiednie opcje, dostosować założenia i zobaczyć jak zmienia się wynik, override'ować rekomendację i wrócić do poprzedniej sesji.

**FRs:** FR14, FR15, FR22, FR23, FR27
**UX:** UX-DR8 (assumption adjustment UI)
**Dependencies:** Epic 2 (needs recommendation engine)

### Epic 4: Deep Explainability & Trust Depth (MVP stretch)
User widzi pełny Trust Panel z freshness/sources/scope, Readiness Gate, trace per pipeline stage (progressive disclosure), reversal factors — co mogłoby zmienić odpowiedź.

**FRs:** FR29, FR32
**UX:** UX-DR2 (Trust Panel), UX-DR3 (Readiness Gate), UX-DR11 (trace view)
**Dependencies:** Epic 2 (consumes TraceEntry[] already produced by pipeline)
**Note:** Opcjonalny w MVP. Dane trace produkowane w Epic 2; ten epic dodaje UI.

### Epic 5: Safety Rails & Basic Audit
Founder/ops może prześledzić rekomendację do danych źródłowych, zobaczyć log decyzji, ograniczyć/flagować rekomendacje przy wątpliwościach, pomóc userowi naprawić dane. Minimal — bez RBAC, bez dedykowanego dashboard.

**FRs:** FR39, FR40, FR41, FR42
**Dependencies:** Epic 2+3 (needs trace infrastructure and session data)

---

## Stories

### Epic 0: Local-First Infrastructure & Backend Migration

#### Story 0.1: Local k3d Cluster Bootstrap Script

As a **developer**,
I want a one-command script that spins up a 2-node k3d cluster mirroring the planned OCI topology,
So that I can iterate on infrastructure changes locally without cloud costs.

**Acceptance Criteria:**

**Given** Docker Desktop with WSL2 backend is running
**When** developer runs `./infrastructure/local/bootstrap.sh`
**Then** k3d creates cluster `njord` with 1 server (label `role=db-control`) + 1 agent (label `role=app`)
**And** server node is constrained to **2 CPU / 16 GB RAM** (mirrors planned OCI A1.Flex shape for control+db+argocd node)
**And** agent node is constrained to **2 CPU / 8 GB RAM** (mirrors planned OCI A1.Flex shape for app node)
**And** limits applied via `k3d cluster create --servers-memory 16g --agents-memory 8g` plus `docker update --cpus=2` post-create for both containers (k3d lacks native CPU flag)
**And** Traefik is disabled (will be re-enabled per Story 0.4 or replaced by CF Tunnel later)
**And** ports 80/443 are exposed on loadbalancer to host
**And** `kubectl get nodes` returns both nodes in Ready state
**And** `kubectl describe node` shows resource capacity matching the configured limits
**And** script is idempotent (re-run does not error if cluster exists)

*Covers: NFR3*

---

#### Story 0.2: Repository Refactor — Frontend Move & Backend Scaffold

As a **developer**,
I want `src/` renamed to `frontend/` and a `backend/` Go module scaffolded,
So that monorepo layout reflects the new client/server split.

**Acceptance Criteria:**

**Given** current repo with `src/`, `functions/`
**When** refactor PR lands
**Then** `src/` is renamed to `frontend/` (git history preserved via `git mv`)
**And** `vite.config.ts`, `tsconfig.json`, `tailwind.config`, `playwright.config.ts`, `package.json` scripts, `.github/workflows/*` updated to new path
**And** `backend/` directory contains: `go.mod` (module `github.com/SunBear1/Njord/backend`), `cmd/server/main.go` (stub HTTP server on :8080 with `/api/v1/health` returning 200), `Dockerfile` (multi-stage, distroless final image <20 MB)
**And** all existing validation passes: `npx tsc --noEmit && npm run lint && npm test && npm run build && npx playwright test`
**And** `go build ./...` and `go test ./...` from `backend/` succeed
**And** all Twelve Data dead-code references removed (docs, comments, types)

*Covers: NFR3, NFR6*

---

#### Story 0.3: Postgres Helm Chart with Local-Path PVC

As a **developer**,
I want a Helm chart that deploys a single-replica Postgres with persistent storage,
So that the backend has a database to hold cache, sessions, and future portfolio data.

**Acceptance Criteria:**

**Given** k3d cluster from Story 0.1 is running
**When** `helm install postgres infrastructure/charts/postgres` is executed
**Then** chart creates: Namespace `njord-data`, StatefulSet (replicas=1, image `postgres:16-alpine`, nodeSelector `role=db-control`), PVC 10Gi (local-path storage class), Service ClusterIP on 5432, Secret with generated password (kubectl-create-secret pattern for local; SealedSecret pattern documented for cloud)
**And** Postgres pod reaches Ready in <60s
**And** `kubectl exec` + `psql` connects and `\dt` works
**And** ConfigMap injects baseline `postgresql.conf` overrides (max_connections=50, shared_buffers=128MB suitable for 16GB node)
**And** chart `helm lint` passes and `helm template` produces valid YAML

*Covers: NFR3*

---

#### Story 0.4: Frontend Helm Chart with Traefik Ingress

As a **developer**,
I want the React SPA deployed as nginx pod behind Traefik ingress on `njord.localhost`,
So that I can access the app at a real hostname matching the planned cloud setup.

**Acceptance Criteria:**

**Given** Postgres chart deployed and k3d running
**When** `helm install frontend infrastructure/charts/frontend` runs
**Then** chart creates: Deployment (image `ghcr.io/sunbear1/njord-frontend:<tag>`, replicas=1, nodeSelector `role=app`, nginx serving `/dist`), Service ClusterIP :80, Traefik IngressRoute for `njord.localhost`
**And** Traefik is re-enabled in k3d config (override Story 0.1 disable for local)
**And** opening `http://njord.localhost` in browser loads the SPA (Chrome resolves `*.localhost` to 127.0.0.1 automatically)
**And** SPA routes (`/comparison`, `/forecast`, etc.) render via SPA fallback (nginx try_files → index.html)
**And** chart uses values structure consistent with `inpost_task/charts/spring_boot_api/` reference (nested config under `frontend:` key)

*Covers: NFR3*

---

#### Story 0.5: Backend Helm Chart with Health Endpoint

As a **developer**,
I want a Go backend pod exposing `/api/v1/health`, routable via Traefik on the same hostname as frontend,
So that the client can call backend without CORS issues and I can prove the full request path works.

**Acceptance Criteria:**

**Given** frontend chart deployed
**When** `helm install backend infrastructure/charts/backend` runs
**Then** chart creates: Deployment (image `ghcr.io/sunbear1/njord-backend:<tag>`, nodeSelector `role=app`, resource requests 200m/512Mi, limits 1500m/4Gi), Service ClusterIP :8080, Traefik IngressRoute matching path `/api/v1/*` on `njord.localhost`
**And** `curl http://njord.localhost/api/v1/health` returns 200 with JSON `{status:"ok", version:"<git-sha>"}`
**And** Deployment has livenessProbe + readinessProbe on `/api/v1/health` (initialDelay 5s, period 5s)
**And** Postgres connection secret mounted as env vars (`DATABASE_URL`)
**And** backend logs structured JSON to stdout (slog default)

*Covers: NFR3, NFR5*

---

#### Story 0.6: Port `/api/v1/finance/stocks` to Go (Yahoo + NBP) with Postgres Cache

As a **self-directed investor**,
I want stock market data fetched via the new Go backend instead of Cloudflare Pages Functions,
So that the local cluster serves real Yahoo Finance data end-to-end through the frontend.

**Acceptance Criteria:**

**Given** backend chart deployed with Postgres connection
**When** frontend makes request to `/api/v1/finance/stocks?symbol=AAPL`
**Then** Go handler proxies Yahoo Finance free-tier endpoint (no API key) and NBP Table A for FX conversion to PLN
**And** response shape matches existing TS handler in `functions/api/v1/finance/stocks/` (parity verified by test fixture comparison)
**And** results cached in Postgres table `cache(provider, key, value_json, expires_at)` with 1h TTL for market data
**And** cache miss triggers external fetch; cache hit returns stored value with `X-Cache: HIT` header
**And** Go handler has unit tests (mocked HTTP) and 1 integration test (real Yahoo call, can be skipped in CI via build tag)
**And** frontend hook `useAssetData.ts` continues to work unchanged (URL identical)

*Covers: FR (existing market data integration), NFR1*

---

#### Story 0.7: Port Remaining Finance APIs (bonds, currency, inflation)

As a **self-directed investor**,
I want bonds, currency rates, and inflation endpoints served by the Go backend,
So that all finance integrations are unified on the new platform.

**Acceptance Criteria:**

**Given** Story 0.6 patterns established
**When** developer ports each handler
**Then** `/api/v1/finance/bonds`, `/api/v1/finance/currency`, `/api/v1/finance/inflation` exist in Go backend with response parity to TS versions
**And** bonds endpoint reads from CSV preset bundled in Go binary (24h cache in Postgres)
**And** currency endpoint scrapes Alior Kantor + NBP Table C with 1h cache
**And** inflation endpoint pulls HICP from ECB with 24h cache
**And** each handler has unit tests (mocked) + 1 integration test
**And** all existing frontend hooks function unchanged

*Covers: existing FRs for market data, NFR1*

---

#### Story 0.8: Port Auth APIs (JWT + OAuth GitHub/Google) to Go

As a **self-directed investor**,
I want authentication endpoints migrated to Go with Postgres-backed sessions,
So that login/logout/me/register work on the new stack and `functions/` can be removed.

**Acceptance Criteria:**

**Given** finance APIs ported (Story 0.7)
**When** auth endpoints implemented in Go
**Then** `/api/v1/auth/{login,logout,register,me,change-password,delete-account,github/*,google/*}` exist with response parity
**And** JWT signing uses HS256 with secret from k8s Secret (env `JWT_SECRET`)
**And** OAuth callbacks redirect correctly with `OAUTH_REDIRECT_BASE` env
**And** users table migrated from D1 schema to Postgres (`infrastructure/charts/postgres/templates/migrations/001-init.sql` applied via initContainer or pgInit Job)
**And** Playwright auth E2E tests pass against `http://njord.localhost`
**And** `functions/` directory deleted in this PR
**And** Cloudflare Pages config in `infrastructure/terraform/` marked deprecated (not yet deleted — kept until cloud cutover in Epic 99)

*Covers: existing auth functionality, NFR6*

---

#### Story 0.9: ArgoCD Installation + 4 Applications (App-of-Apps)

As a **developer**,
I want ArgoCD installed in the cluster managing all 4 service Helm charts via GitOps,
So that pushing to `main` automatically reconciles the cluster to match git.

**Acceptance Criteria:**

**Given** all 4 Helm charts (postgres, frontend, backend, ingress) exist and deploy manually
**When** ArgoCD installed via official manifest into `argocd` namespace
**Then** root `Application` resource at `infrastructure/argocd/` syncs 4 child `Application` resources (one per chart) using app-of-apps pattern
**And** each child Application has `syncPolicy.automated.{prune, selfHeal}: true` and `syncOptions: [CreateNamespace=true]`
**And** ArgoCD UI accessible via port-forward (`kubectl port-forward svc/argocd-server -n argocd 8080:443`)
**And** for local phase, ArgoCD uses default local admin (password retrieved via `kubectl get secret argocd-initial-admin-secret`); SSO via Cloudflare Access deferred to Epic 99
**And** Helm chart structure for `infrastructure/argocd/` follows `inpost_task/argocd/` reference (Chart.yaml + templates with `application.*.yaml`)
**And** manually deleting a Deployment triggers ArgoCD selfHeal within 3 minutes

*Covers: NFR3*

---

#### Story 0.10: release-please + GitHub Actions Image Build Pipeline

As a **developer**,
I want pushes to `main` to trigger conventional-commit release PRs, and merged release tags to build/push images and bump Helm values,
So that releases are versioned (semver), traceable, and deployed via GitOps without manual intervention.

**Acceptance Criteria:**

**Given** Stories 0.2–0.9 complete
**When** developer pushes `feat: ...` commit to `main`
**Then** release-please bot opens "chore: release vX.Y.Z" PR with CHANGELOG and Chart.yaml version bump
**And** when release PR is merged, bot creates git tag `vX.Y.Z` and GitHub Release
**And** tag-triggered workflow builds frontend and backend Docker images, tags as `X.Y.Z`, `X.Y`, `latest`, pushes to `ghcr.io/sunbear1/njord-frontend` and `ghcr.io/sunbear1/njord-backend` (public registry, no pull secret needed)
**And** workflow commits image tag bump to `infrastructure/charts/{frontend,backend}/values.yaml` and pushes back to main
**And** ArgoCD (local: polling; cloud: webhook) detects change and reconciles
**And** images use multi-stage builds: backend distroless <20 MB, frontend nginx:alpine + dist <30 MB
**And** workflow has `permissions: { contents: write, packages: write }` only — no other elevated rights

*Covers: NFR3*

---

#### Story 0.11: Local E2E Smoke Test on k3d Cluster

As a **developer**,
I want Playwright E2E tests executable against the local k3d cluster,
So that I can verify the entire system (frontend → backend → Postgres → external APIs) before declaring Epic 0 done.

**Acceptance Criteria:**

**Given** all previous Epic 0 stories complete and ArgoCD has synced all 4 apps
**When** developer runs `PLAYWRIGHT_BASE_URL=http://njord.localhost npx playwright test`
**Then** existing test suite passes against the live cluster (not against `npm run preview`)
**And** at least one new smoke test validates: open `/forecast`, fetch real Yahoo data for SPY, render forecast chart, no console errors
**And** at least one new smoke test validates: register user, login, see authenticated state
**And** README updated with local development workflow: `./infrastructure/local/bootstrap.sh && helm install ... && npx playwright test`
**And** all stored memories in this session about validation chain (npx tsc, lint, test, build) still hold for `frontend/` directory

*Covers: NFR1, NFR3, NFR5*

---

### Epic 1: Portfolio Foundation

#### Story 1.1: Manual Position Entry

As a **self-directed investor**,
I want to manually add stock/ETF positions (ticker, quantity, average price, currency, source),
So that I can build my portfolio snapshot without broker integration.

**Acceptance Criteria:**

**Given** user is on the portfolio page
**When** they click "Add position" and fill ticker, qty, avg price, currency
**Then** position is saved to local state and visible in the portfolio list
**And** inline validation rejects: empty ticker, qty ≤ 0, negative price, missing currency
**And** duplicate ticker from same source shows merge prompt

*Covers: FR2, FR8, UX-DR7*

---

#### Story 1.2: Portfolio Overview & Data Quality Score

As a **self-directed investor**,
I want to see all my positions with a per-position and overall data quality score,
So that I know how trustworthy my portfolio snapshot is before requesting a recommendation.

**Acceptance Criteria:**

**Given** portfolio has ≥1 position
**When** user views portfolio page
**Then** each position shows: ticker, qty, avg price, currency, source, freshness indicator, quality badge
**And** overall portfolio quality score is computed (0-100%) based on completeness + freshness
**And** stale positions (>24h since last price update) show staleness warning with timestamp
**And** empty portfolio shows helpful empty state with "Add first position" CTA

*Covers: FR4, FR5, UX-DR12*

---

#### Story 1.3: Position Edit & Delete

As a **self-directed investor**,
I want to edit or remove positions from my portfolio,
So that I can correct mistakes and keep my snapshot accurate.

**Acceptance Criteria:**

**Given** a position exists in portfolio
**When** user clicks edit on a position
**Then** pre-filled form allows changing qty, avg price, source
**And** ticker change is treated as delete + new add (to preserve history)
**When** user clicks delete
**Then** confirmation dialog shows position details before removal
**And** after confirmation, position is removed and quality score recalculates

*Covers: FR8, FR3*

---

#### Story 1.4: Incomplete Portfolio Handling

As a **self-directed investor**,
I want the system to explicitly handle incomplete data (missing avg price, partial positions),
So that I understand what's missing and how it affects recommendation quality.

**Acceptance Criteria:**

**Given** portfolio has positions with missing fields (e.g., no avg price)
**When** user views portfolio
**Then** incomplete positions are visually flagged (not hidden)
**And** each missing field shows impact on analysis scope ("bez ceny nabycia → brak kalkulacji podatku")
**And** portfolio can still be used for recommendation with degraded confidence
**And** readiness summary shows: X of Y positions complete, missing fields list

*Covers: FR7, UX-DR12*

---

#### Story 1.5: Multi-source Consolidation & Conflict Resolution

As a **self-directed investor**,
I want to see consolidated view when same ticker appears from multiple sources,
So that I have one accurate picture without duplicates or contradictions.

**Acceptance Criteria:**

**Given** same ticker exists from 2+ sources (e.g., manual + import)
**When** user views portfolio
**Then** positions are merged into one row with source priority indicator
**And** if qty/price conflict exists, conflict badge appears with both values shown
**When** user clicks resolve conflict
**Then** they choose which source to trust OR enter manual override
**And** resolution is saved and conflict badge disappears
**And** data quality score improves after resolution

*Covers: FR1, FR6, FR3*
