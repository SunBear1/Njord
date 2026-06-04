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
Buduje self-hosted infrastrukturę na lokalnym 2-node k3d klastrze symulującym docelowy OCI setup. Refactor `src/`→`frontend/`, scaffold Go backendu, port wszystkich finance API z Cloudflare Pages Functions, port JWT auth (OAuth deferred), instalacja ArgoCD z lokalnym admin/test, Helm charts dla 4 serwisów, lokalne wersjonowane obrazy ładowane do k3d. **W pełni offline — zero zależności od zewnętrznych providerów wymagających rejestracji (GHCR, OAuth providers, OCI, domena).**

**FRs:** N/A (infrastructure foundation)
**NFRs:** NFR1 (perf), NFR3 (deploy), NFR5 (observability), NFR6 (security — local scope)
**Arch:** Go backend (kontynuacja `GO_BACKEND_PLAN.md`), Postgres single-replica StatefulSet z local-path PVC, Helm charts w `infrastructure/charts/`, ArgoCD app-of-apps w `infrastructure/argocd/`, Traefik ingress, lokalne obrazy `njord-{frontend,backend}:<semver>` via `k3d image import`
**Cleanup:** Usuń Twelve Data referencje (dead code), usuń `functions/` po pomyślnym porcie
**Dependencies:** None (blocker dla Epic 1-5)
**Out of scope (→ Epic 99):** GHCR/jakikolwiek zewnętrzny registry, OAuth (GitHub/Google), Cloudflare Tunnel/Access, domena, OCI provisioning, ArgoCD SSO, real DNS

### Epic 99: Production Deployment (Cloud)
Wszystkie elementy produkcyjnej hosted infrastructure, uruchamiane **DOPIERO po ukończeniu Epic 0-5** — tylko jeśli MVP zostanie uznane za wartościowe i godne wydatku na chmurę. Skeptical-by-default: jeśli po implementacji wszystkich epików produkt okaże się nieprzekonujący, Epic 99 może nigdy nie wystartować.

**Zakres (high-level, stories TBD):**
- Domena via Cloudflare Registrar (`.dev` lub `.app`)
- Terraform OCI: 2× A1.Flex (4 OCPU + 24 GB total = Always Free Tier)
- OCI Block Volume + `oci-csi` driver dla Postgres PVC
- Cloudflare Tunnel zamiast Traefika (zero exposed ports)
- Cloudflare Access OIDC dla ArgoCD UI (local admin disabled)
- GitHub Actions OIDC trust do OCI (zero długoterminowych sekretów)
- GHCR push pipeline: tag push → image build → ghcr.io public → ArgoCD reconcile via values.yaml bump
- OAuth providers: GitHub OAuth App + Google OAuth App z callback URLs do real domeny
- Big bang DNS cutover, retirement `njord.pages.dev`, deletion `functions/` legacy
- Backupy Postgres → R2 (Cloudflare zero-egress)

**Dependencies:** Epic 0-5 done + decyzja "yes, this product is worth hosting"
**Trigger:** Manualny, świadomy. Nie zaczynamy bez ukończonego MVP.

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
**GATE:** Story 2.1 (Financial Methodology Audit) must produce verdict GO or PIVOT before Stories 2.2+ start. NO-GO verdict → Epic 2 scope replaced or dropped.

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

#### Story 0.8: Port Auth APIs (JWT-only) to Go

As a **self-directed investor**,
I want JWT authentication endpoints migrated to Go with Postgres-backed users,
So that login/logout/me/register work on the new stack and `functions/` can be removed.

**Acceptance Criteria:**

**Given** finance APIs ported (Story 0.7)
**When** auth endpoints implemented in Go
**Then** `/api/v1/auth/{login,logout,register,me,change-password,delete-account}` exist with response parity to TS versions
**And** JWT signing uses HS256 with secret from k8s Secret (env `JWT_SECRET`)
**And** users table migrated from D1 schema to Postgres (`infrastructure/charts/postgres/templates/migrations/001-init.sql` applied via initContainer or pgInit Job)
**And** Playwright auth E2E tests pass against `http://njord.localhost`
**And** `functions/` directory deleted in this PR
**And** OAuth flows (GitHub, Google) explicitly OUT OF SCOPE — deferred to Epic 99 (require external provider app registration, not testable in local-only phase)
**And** Cloudflare Pages config in `infrastructure/terraform/` marked deprecated (not yet deleted — kept until cloud cutover in Epic 99)

*Covers: existing auth functionality (JWT subset), NFR6*

---

#### Story 0.9: ArgoCD Installation + 4 Applications (App-of-Apps)

As a **developer**,
I want ArgoCD installed in the cluster managing all 4 service Helm charts via GitOps,
So that committing to the local repo reconciles the cluster to match git (no manual `helm upgrade` needed during local development iteration).

**Acceptance Criteria:**

**Given** all 4 Helm charts (postgres, frontend, backend, ingress) exist and deploy manually
**When** ArgoCD installed via official manifest into `argocd` namespace
**Then** root `Application` resource at `infrastructure/argocd/` syncs 4 child `Application` resources (one per chart) using app-of-apps pattern
**And** each child Application has `syncPolicy.automated.{prune, selfHeal}: true` and `syncOptions: [CreateNamespace=true]`
**And** ArgoCD UI accessible via port-forward (`kubectl port-forward svc/argocd-server -n argocd 8080:443`)
**And** ArgoCD uses local admin user with password `test` (LOCAL DEVELOPMENT ONLY — explicitly insecure, acceptable because cluster is on developer machine; Cloudflare Access SSO deferred to Epic 99)
**And** Helm chart structure for `infrastructure/argocd/` follows `inpost_task/argocd/` reference (Chart.yaml + templates with `application.*.yaml`)
**And** manually deleting a Deployment triggers ArgoCD selfHeal within 3 minutes

*Covers: NFR3*

---

#### Story 0.10: Local Image Build & Versioning

As a **developer**,
I want a script that builds Docker images for frontend and backend with semver tags and loads them directly into the k3d cluster,
So that I have reproducible, versioned local artifacts that match the eventual cloud workflow shape — without needing any external registry.

**Acceptance Criteria:**

**Given** Stories 0.2 (Dockerfiles exist), 0.4, and 0.5 complete
**When** developer runs `./infrastructure/local/build-images.sh`
**Then** script reads current version from `VERSION` file at repo root (single source of truth, e.g. `0.1.0`)
**And** script builds two images: `njord-frontend:<VERSION>` and `njord-backend:<VERSION>`, plus aliases `:latest` and `:<MAJOR>.<MINOR>` (e.g. `0.1`)
**And** images are loaded into k3d cluster via `k3d image import njord-frontend:<VERSION> njord-backend:<VERSION> -c njord`
**And** Helm chart values reference `image.repository: njord-{frontend,backend}` and `image.tag` pulled from `VERSION` (templated via `--set image.tag=$(cat VERSION)` in a `helm-upgrade.sh` helper, OR via `values.yaml` updated by release-please)
**And** images use multi-stage builds: backend distroless `<20 MB`, frontend `nginx:alpine` + dist `<30 MB` (verify via `docker image ls`)
**And** `release-please` is configured in `.github/workflows/release-please.yml` to manage CHANGELOG and bump `VERSION` file on merged release PRs (commit-only — push to ghcr.io explicitly OUT OF SCOPE, deferred to Epic 99)
**And** GitHub Actions workflow `local-image-validation.yml` runs `docker build` for both images on every PR to catch Dockerfile regressions (no push, just build)
**And** script is idempotent and prints final summary: built images, sizes, k3d import result

*Covers: NFR3*

**Note:** Cloud-side image push pipeline (ghcr.io push, image tag bump in Helm values via bot, ArgoCD webhook reconciliation) deferred to Epic 99 Story 99.X. This story sets up the foundation (Dockerfile + versioning + release-please) so the Epic 99 work is purely "wire it up to GHCR".

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
**And** at least one new smoke test validates: register user (JWT only, no OAuth), login, see authenticated state
**And** README updated with local development workflow: `./infrastructure/local/bootstrap.sh && ./infrastructure/local/build-images.sh && helm install ... && npx playwright test`
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

---

### Epic 2: Decision Engine + Minimal Trust

#### Story 2.1: Financial Methodology Audit & Honest Prediction Boundaries

> **Type:** Research/Validation (no production code) — gate dla pozostałych stories w Epic 2
> **Output:** Pisemny raport + decyzja go / pivot / no-go dla Decision Engine

As a **product owner skeptical that "stock recommendations" can be honest**,
I want a rigorous methodology audit of existing prediction models against literature, backtests, and benchmark baselines, plus an explicit map of what we CAN and CANNOT claim,
So that the Decision Engine (Stories 2.2+) is built on honest foundations — not on overconfident pseudo-science that will mislead users and create regulatory/reputational risk.

**Background / Motivation:**

The product owner expressed strong skepticism: *"Jestem mocno sceptyczny czy rekomendacje będą mówiły prawdę."* This is the most important risk in the entire project. The existing codebase has 3 prediction models (`src/utils/models/gbm.ts`, `bootstrap.ts`, `hmm.ts`) and an automated backtest pipeline (`.github/workflows/backtest.workflow.yaml` producing `backtest-metrics.json`). Before we build user-facing "verdicts" (strong/conditional/none), we must prove:

1. Models perform better than trivial baselines (random walk, "always buy SPY", "always hold cash")
2. We understand and document the regimes where they fail
3. The UI translates model output into claims a regulator and an honest financial advisor would defend
4. We have a stop-rule for when to say "we don't know" instead of fabricating confidence

**Acceptance Criteria:**

**Given** the existing model code in `src/utils/models/` and backtest infrastructure
**When** the methodology audit is conducted
**Then** an audit report is produced at `docs/methodology-audit-2026-q2.md` covering all sections below
**And** the report concludes with one of three explicit verdicts: GO (proceed with Epic 2 as planned), PIVOT (proceed but with specified scope changes), NO-GO (Decision Engine cannot honestly deliver value — recommend dropping it from MVP)

**Required report sections:**

1. **Model inventory & current claims** — Document what each model (GBM calibrated, Block Bootstrap, HMM Monte Carlo) actually produces: input shape, output shape, time horizons, calibration data window, assumptions explicitly baked in (normal returns? stationary regime? constant volatility?).

2. **Backtest results vs baselines** — Run/recompute backtests for SPY, QQQ, EWP (Polish ETF), TLT (bonds), and 2-3 individual stocks (AAPL, KGHM, PKO BP if available). For each model, compare against baselines:
   - Random walk (drift = historical mean, vol = historical std)
   - Buy-and-hold (no model — pure benchmark)
   - "Always cash at NBP savings rate" (the actually-honest alternative)
   Metrics: MAPE on point estimates, Brier score on probability bands, calibration plot (do 90% bands actually contain 90% of realized outcomes?), max drawdown of model-suggested allocations vs baseline.

3. **Failure mode catalogue** — Where do models break? Concrete examples to test:
   - 2008 Sep-Nov (regime change)
   - 2020 Mar (COVID crash)
   - 2022 Jan-Oct (sustained drawdown + high inflation)
   - 2024 Polish election (single-country political shock)
   Document realized vs predicted for each. If model bands fail (realized outside 90% band >20% of time during these periods), this is a calibration failure — must be acknowledged in UI.

4. **Literature reality check** — Brief survey of evidence for retail-facing forecasting:
   - Fama efficient markets — what does academic consensus actually say about predictability at retail-relevant horizons (1mo–5yr)?
   - Asset allocation literature (Markowitz, Black-Litterman, risk parity) vs single-asset prediction
   - Documented failures of retail forecast products (search regulatory enforcement actions: FCA, ESMA, KNF for "misleading forecast" cases)
   - Specifically: does anyone honestly claim to predict 12-month equity returns better than buy-and-hold? Cite or admit no.

5. **Honest claim boundary** — Explicit list of what we CAN and CANNOT claim in UI:
   - ❌ "SPY will be 12% higher in 12 months"
   - ❌ "Buy AAPL now — strong recommendation"
   - ✅ "If past 5y volatility persists, there is a ~70% probability your portfolio ends within ±18% over 12 months. Models offer no predictive edge over historical mean — they characterize range, not direction."
   - ✅ "After tax and FX, savings account at 5.5% beats SPY in 47% of historical 12-month windows since 2010. Today's verdict: comparable. Choice depends on liquidity needs, not on prediction."
   For each FR (FR9-FR13, FR16-FR19, etc.) referenced by Epic 2, mark which side of the boundary it falls on.

6. **Comparison module honesty audit** — Re-examine the recent `comparisonDecision` refactor (commit `dc99c0b`) that softened "rekomendacja/werdykt" → "wynik porównania". Validate this language change is sufficient, OR specify further changes needed (e.g., always show benchmark = "do nothing / hold cash" as a third column).

7. **Stop-rules for the engine** — Define conditions under which the engine MUST refuse to produce a verdict (return "no recommendation" instead of "weak recommendation"):
   - Data freshness < threshold (e.g., last price >7 days old)
   - Symbol not in calibration set
   - User horizon shorter than minimum statistical reliability (probably anything <6mo)
   - Detected regime change in last N days (HMM probability of regime shift >X)
   - Macro events flag (manual flag for FOMC week, election week — explicitly out of model assumptions)

8. **Disclosure spec for UI** — Concrete copy (in Polish) for the recommendation surface that satisfies the honest-claim boundary. Will become input for UX-DR1 (Verdict First Stack) and UX-DR6 (no-recommendation state) work in Stories 2.2+.

9. **Verdict: GO / PIVOT / NO-GO** — Final section. If GO: proceed to Story 2.2. If PIVOT: list scope changes (e.g., "drop point-estimate forecasting; engine becomes 'options comparator' only"). If NO-GO: justify and propose Epic 2 replacement (e.g., "skip recommendations; offer scenario simulator + portfolio diagnostics only").

**Given** the report is complete and verdict reached
**When** the report is reviewed by the product owner
**Then** any GO verdict requires sign-off — without explicit "GO approved" comment on the story, Stories 2.2+ remain blocked
**And** the report is committed to `docs/` and linked from `epics.md` Epic 2 description
**And** if PIVOT, this story spawns follow-up tasks to update Epic 2 scope and FR list in `prd.md` before Story 2.2 starts

**Validation gates:**

- Gate 1 (static): all citations in report have working URLs or DOIs
- Gate 2 (data): backtests run on at least 5 instruments × 4 stress periods (= 20 data points minimum)
- Gate 3 (rubber-duck): report reviewed by `rubber-duck` agent specifically for overconfidence — any sentence claiming the model "predicts" or "forecasts" must be flagged unless wrapped in explicit uncertainty qualifier
- Gate 4 (regression): no production code changed in this story (verify `git diff --stat` shows only `docs/` and `_bmad-output/` paths)
- Gate 5 (owner sign-off): product owner explicit approval required before story can move to `done`

**Dependencies:** None (can be executed in parallel with Epic 0; ideally completed before Epic 1 stories that touch prediction UX)

**Tools available for execution:**

- `Financial Calculator` custom agent — for technical model audits
- `rubber-duck` agent — for overconfidence detection
- `research` agent — for literature review
- Web fetch — for regulatory and academic source verification
- Existing `backtest-metrics.json` artifacts from past CI runs in repo history

*Covers: FR (no specific FR — meta-validation), risk mitigation for FR9-FR13*

---